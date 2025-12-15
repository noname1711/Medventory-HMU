package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ReceiptService {

    private final ReceiptHeaderRepository receiptHeaderRepository;
    private final ReceiptDetailRepository receiptDetailRepository;
    private final InventoryCardRepository inventoryCardRepository;

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;

    private final NotificationService notificationService;

    public ReceiptResponseDTO createReceipt(CreateReceiptDTO request, Long creatorId) {
        try {
            User creator = userRepository.findById(creatorId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!creator.isApproved()) {
                throw new RuntimeException("Tài khoản chưa được kích hoạt");
            }
            if (!creator.isThuKho()) {
                throw new RuntimeException("Chỉ thủ kho được tạo phiếu nhập");
            }

            validateCreateReceipt(request);

            ReceiptHeader header = new ReceiptHeader();
            header.setCreatedBy(creator);

            header.setReceiptDate(request.getReceiptDate() != null ? request.getReceiptDate() : LocalDate.now());

            String receivedFrom = safeTrim(request.getReceivedFrom());
            String deliveryPerson = safeTrim(request.getDeliveryPerson());

            // DB không có cột người giao -> gộp vào received_from theo format rõ ràng
            if (!deliveryPerson.isEmpty()) {
                receivedFrom = receivedFrom + " - Người giao: " + deliveryPerson;
            }
            header.setReceivedFrom(receivedFrom);

            String reason = safeTrim(request.getReason());
            header.setReason(reason.isEmpty() ? "Nhu cầu từ đơn vị" : reason);

            header.setTotalAmount(BigDecimal.ZERO);

            header = receiptHeaderRepository.save(header);

            List<ReceiptDetail> details = createDetailsAndInventory(header, request);
            header.setDetails(details);

            // Recalc total_amount chuẩn theo DB logic
            BigDecimal totalAmount = details.stream()
                    .map(d -> nvl(d.getTotal()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);

            header.setTotalAmount(totalAmount);
            header = receiptHeaderRepository.save(header);

            // Notify (console)
            notificationService.notifyNewReceipt(header);

            ReceiptHeaderDTO headerDTO = convertHeaderToDTO(header);
            Map<String, Object> summary = createSummary(header);

            List<ReceiptDetailDTO> detailDTOs = headerDTO.getDetails();

            return ReceiptResponseDTO.success("Tạo phiếu nhập kho thành công", headerDTO, detailDTOs, summary);

        } catch (Exception e) {
            return ReceiptResponseDTO.error("Lỗi khi tạo phiếu nhập: " + e.getMessage());
        }
    }

    public ReceiptResponseDTO getReceiptDetail(Long receiptId, Long userId) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!user.isApproved()) {
                throw new RuntimeException("Tài khoản chưa được kích hoạt");
            }

            ReceiptHeader header = receiptHeaderRepository.findById(receiptId)
                    .orElseThrow(() -> new RuntimeException("Phiếu nhập không tồn tại"));

            // Quyền xem: thủ kho hoặc lãnh đạo/BGH (giống pattern IssueReq)
            if (!(user.isThuKho() || user.isLanhDao() || user.isBanGiamHieu())) {
                throw new RuntimeException("Bạn không có quyền xem phiếu nhập");
            }

            List<ReceiptDetail> details = receiptDetailRepository.findByHeaderId(receiptId);
            header.setDetails(details);

            ReceiptHeaderDTO headerDTO = convertHeaderToDTO(header);
            Map<String, Object> summary = createSummary(header);

            return ReceiptResponseDTO.success("Lấy chi tiết phiếu nhập thành công",
                    headerDTO, headerDTO.getDetails(), summary);

        } catch (Exception e) {
            return ReceiptResponseDTO.error("Không thể tải chi tiết phiếu nhập: " + e.getMessage());
        }
    }

    // -------------------- Helpers --------------------

    private void validateCreateReceipt(CreateReceiptDTO request) {
        if (request == null) throw new RuntimeException("Request không hợp lệ");

        if (safeTrim(request.getReceivedFrom()).isEmpty()) {
            throw new RuntimeException("Nhà cung cấp/nguồn nhận hàng không được để trống");
        }

        if (request.getDetails() == null || request.getDetails().isEmpty()) {
            throw new RuntimeException("Phiếu nhập phải có ít nhất 1 dòng hàng");
        }

        for (CreateReceiptDetailDTO d : request.getDetails()) {
            if ((d.getMaterialId() == null) && safeTrim(d.getMaterialCode()).isEmpty()) {
                throw new RuntimeException("Mỗi dòng phải có materialId hoặc materialCode");
            }

            if (d.getQtyActual() == null || d.getQtyActual().compareTo(BigDecimal.ZERO) <= 0) {
                throw new RuntimeException("Số lượng thực nhập (qtyActual) phải > 0");
            }

            if (d.getPrice() == null || d.getPrice().compareTo(BigDecimal.ZERO) < 0) {
                throw new RuntimeException("Đơn giá (price) không hợp lệ");
            }

            if (safeTrim(d.getLotNumber()).isEmpty()) {
                throw new RuntimeException("Số lô (lotNumber) không được để trống");
            }

            if (d.getMfgDate() != null && d.getExpDate() != null) {
                if (d.getExpDate().isBefore(d.getMfgDate())) {
                    throw new RuntimeException("Hạn sử dụng phải >= ngày sản xuất");
                }
            }
        }
    }

    private List<ReceiptDetail> createDetailsAndInventory(ReceiptHeader header, CreateReceiptDTO request) {
        String warehouseName = safeTrim(request.getWarehouseName());
        if (warehouseName.isEmpty()) warehouseName = "Kho chính";

        List<ReceiptDetail> details = new ArrayList<>();

        for (CreateReceiptDetailDTO dto : request.getDetails()) {
            Material material = resolveMaterial(dto);

            ReceiptDetail detail = new ReceiptDetail();
            detail.setHeader(header);
            detail.setMaterial(material);

            // snapshot từ materials
            detail.setName(material.getName());
            detail.setSpec(material.getSpec());
            detail.setCode(material.getCode());
            detail.setUnit(material.getUnit());

            detail.setPrice(dto.getPrice().setScale(2, RoundingMode.HALF_UP));
            detail.setQtyDoc(dto.getQtyDoc());
            detail.setQtyActual(dto.getQtyActual());

            detail.setLotNumber(safeTrim(dto.getLotNumber()));
            detail.setMfgDate(dto.getMfgDate());
            detail.setExpDate(dto.getExpDate());

            BigDecimal lineTotal = dto.getPrice()
                    .multiply(dto.getQtyActual())
                    .setScale(2, RoundingMode.HALF_UP);
            detail.setTotal(lineTotal);

            details.add(detail);

            // Tạo inventory_card theo (material, lot)
            createInventoryCardForReceiptLine(material, detail, header, warehouseName);
        }

        return receiptDetailRepository.saveAll(details);
    }

    private void createInventoryCardForReceiptLine(Material material, ReceiptDetail detail,
                                                   ReceiptHeader header, String warehouseName) {

        String lot = detail.getLotNumber();

        BigDecimal opening = inventoryCardRepository
                .findTopByMaterialIdAndLotNumberOrderByRecordDateDescIdDesc(material.getId(), lot)
                .map(InventoryCard::getClosingStock)
                .orElse(BigDecimal.ZERO);

        InventoryCard card = new InventoryCard();
        card.setMaterial(material);
        card.setUnit(material.getUnit());
        card.setWarehouseName(warehouseName);
        card.setRecordDate(header.getReceiptDate());

        card.setOpeningStock(nvl(opening));
        card.setQtyIn(nvl(detail.getQtyActual()));
        card.setQtyOut(BigDecimal.ZERO);

        card.setSupplier(header.getReceivedFrom());
        card.setLotNumber(lot);
        card.setMfgDate(detail.getMfgDate());
        card.setExpDate(detail.getExpDate());

        // sub_department_id: nhập kho không gắn trực tiếp đơn vị -> để null
        card.setSubDepartment(null);

        inventoryCardRepository.save(card);
    }

    private Material resolveMaterial(CreateReceiptDetailDTO dto) {
        if (dto.getMaterialId() != null) {
            return materialRepository.findById(dto.getMaterialId())
                    .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại với ID: " + dto.getMaterialId()));
        }

        String code = safeTrim(dto.getMaterialCode());
        Material m = materialRepository.findByCode(code);
        if (m == null) {
            throw new RuntimeException("Không tìm thấy vật tư theo code: " + code);
        }
        return m;
    }

    private ReceiptHeaderDTO convertHeaderToDTO(ReceiptHeader header) {
        ReceiptHeaderDTO dto = new ReceiptHeaderDTO();
        dto.setId(header.getId());

        if (header.getCreatedBy() != null) {
            dto.setCreatedById(header.getCreatedBy().getId());
            dto.setCreatedByName(header.getCreatedBy().getFullName());
        }

        dto.setReceivedFrom(header.getReceivedFrom());
        dto.setReason(header.getReason());
        dto.setReceiptDate(header.getReceiptDate());
        dto.setTotalAmount(header.getTotalAmount());

        List<ReceiptDetail> details = header.getDetails() != null ? header.getDetails()
                : receiptDetailRepository.findByHeaderId(header.getId());

        List<ReceiptDetailDTO> detailDTOs = details.stream()
                .map(this::convertDetailToDTO)
                .collect(Collectors.toList());

        dto.setDetails(detailDTOs);
        return dto;
    }

    private ReceiptDetailDTO convertDetailToDTO(ReceiptDetail detail) {
        ReceiptDetailDTO dto = new ReceiptDetailDTO();
        dto.setId(detail.getId());

        if (detail.getMaterial() != null) {
            dto.setMaterialId(detail.getMaterial().getId());
        }

        dto.setName(detail.getName());
        dto.setSpec(detail.getSpec());
        dto.setCode(detail.getCode());

        if (detail.getUnit() != null) {
            dto.setUnitId(detail.getUnit().getId());
            dto.setUnitName(detail.getUnit().getName());
        }

        dto.setPrice(detail.getPrice());
        dto.setQtyDoc(detail.getQtyDoc());
        dto.setQtyActual(detail.getQtyActual());
        dto.setTotal(detail.getTotal());

        dto.setLotNumber(detail.getLotNumber());
        dto.setMfgDate(detail.getMfgDate());
        dto.setExpDate(detail.getExpDate());

        return dto;
    }

    private Map<String, Object> createSummary(ReceiptHeader header) {
        Map<String, Object> summary = new HashMap<>();

        List<ReceiptDetail> details = header.getDetails() != null ? header.getDetails()
                : receiptDetailRepository.findByHeaderId(header.getId());

        long totalLines = details.size();
        BigDecimal totalQty = details.stream()
                .map(d -> nvl(d.getQtyActual()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalAmount = details.stream()
                .map(d -> nvl(d.getTotal()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        summary.put("totalLines", totalLines);
        summary.put("totalQuantity", totalQty);
        summary.put("totalAmount", totalAmount);

        return summary;
    }

    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String safeTrim(String s) {
        return s == null ? "" : s.trim();
    }
}
