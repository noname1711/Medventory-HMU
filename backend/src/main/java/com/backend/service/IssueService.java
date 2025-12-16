package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.backend.dto.EligibleIssueReqListResponseDTO;
import org.springframework.data.domain.PageRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class IssueService {

    private final IssueHeaderRepository issueHeaderRepository;
    private final IssueDetailRepository issueDetailRepository;

    private final IssueReqHeaderRepository issueReqHeaderRepository;
    private final InventoryCardRepository inventoryCardRepository;
    private final ReceiptDetailRepository receiptDetailRepository;

    private final UserRepository userRepository;

    // ------------------------- API METHODS -------------------------

    public IssuePreviewResponseDTO previewIssueFromApprovedRequest(Long issueReqId, Long thuKhoId) {
        try {
            User thuKho = validateThuKho(thuKhoId);

            IssueReqHeader req = issueReqHeaderRepository.findById(issueReqId)
                    .orElseThrow(() -> new RuntimeException("Phiếu xin lĩnh không tồn tại"));

            if (!req.isApproved()) {
                throw new RuntimeException("Chỉ cho phép xuất kho với phiếu xin lĩnh đã phê duyệt");
            }

            ensureNotIssuedYet(req);

            IssueReqHeaderDTO reqDTO = toIssueReqDTO(req);

            List<IssuePreviewLineDTO> lines = new ArrayList<>();
            List<String> missingMessages = new ArrayList<>();

            for (IssueReqDetail d : req.getDetails()) {
                if (d.getMaterial() == null) {
                    missingMessages.add("Dòng vật tư chưa có material_id (cần map vật tư trước khi xuất)");
                    continue;
                }

                Material m = d.getMaterial();
                BigDecimal need = nvl(d.getQtyRequested());

                List<InventoryCard> lots = inventoryCardRepository.findAvailableLotsLatestByMaterial(m.getId());
                BigDecimal available = lots.stream()
                        .map(InventoryCard::getClosingStock)
                        .map(IssueService::nvl)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                if (available.compareTo(need) < 0) {
                    missingMessages.add("Thiếu tồn cho " + m.getCode() + " - " + m.getName()
                            + " (cần " + need + ", còn " + available + ")");
                }

                List<LotStockDTO> lotDTOs = buildAutoAllocationPreview(lots, need);

                IssuePreviewLineDTO line = new IssuePreviewLineDTO();
                line.setMaterialId(m.getId());
                line.setName(m.getName());
                line.setCode(m.getCode());
                line.setSpec(m.getSpec());
                if (m.getUnit() != null) {
                    line.setUnitId(m.getUnit().getId());
                    line.setUnitName(m.getUnit().getName());
                }
                line.setQtyRequested(need);
                line.setQtyToIssue(need);
                line.setLots(lotDTOs);

                lines.add(line);
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("totalLines", lines.size());
            summary.put("missingCount", missingMessages.size());
            summary.put("missingMessages", missingMessages);

            if (!missingMessages.isEmpty()) {
                return IssuePreviewResponseDTO.success("Phiếu đã duyệt nhưng chưa đủ tồn để xuất", reqDTO, lines, summary);
            }

            return IssuePreviewResponseDTO.success("Preview xuất kho (FEFO) thành công", reqDTO, lines, summary);

        } catch (Exception e) {
            return IssuePreviewResponseDTO.error("Không thể preview xuất kho: " + e.getMessage());
        }
    }

    public IssueResponseDTO createIssueFromApprovedRequest(CreateIssueFromReqDTO request, Long thuKhoId) {
        try {
            User thuKho = validateThuKho(thuKhoId);

            validateCreateIssueRequest(request);

            IssueReqHeader req = issueReqHeaderRepository.lockByIdForUpdate(request.getIssueReqId());
            if (req == null) throw new RuntimeException("Phiếu xin lĩnh không tồn tại");

            if (!req.isApproved()) {
                throw new RuntimeException("Chỉ cho phép xuất kho với phiếu xin lĩnh đã phê duyệt");
            }

            ensureNotIssuedYet(req);

            LocalDate issueDate = request.getIssueDate() != null ? request.getIssueDate() : LocalDate.now();
            String warehouseName = safeTrim(request.getWarehouseName());
            if (warehouseName.isEmpty()) warehouseName = "Kho chính";

            boolean auto = request.getAutoAllocate() == null || request.getAutoAllocate();

            // 1) Create issue_header
            IssueHeader header = new IssueHeader();
            header.setCreatedBy(thuKho);
            header.setIssueDate(issueDate);
            header.setDepartment(req.getDepartment());

            String defaultReceiver = buildDefaultReceiverName(req);
            String receiver = safeTrim(request.getReceiverName());
            if (receiver.isEmpty()) receiver = defaultReceiver;

            // Marker để chống xuất trùng (không đổi DB)
            receiver = receiver + " (IssueReq#" + req.getId() + ")";
            header.setReceiverName(receiver);
            header.setTotalAmount(BigDecimal.ZERO);

            header = issueHeaderRepository.save(header);

            // 2) Create issue_detail + inventory_card out per lot (FEFO hoặc manual)
            List<IssueDetail> details = new ArrayList<>();

            Map<Long, BigDecimal> reqQtyByMaterial = req.getDetails().stream()
                    .filter(d -> d.getMaterial() != null)
                    .collect(Collectors.toMap(
                            d -> d.getMaterial().getId(),
                            d -> nvl(d.getQtyRequested()),
                            BigDecimal::add
                    ));

            if (auto) {
                for (IssueReqDetail d : req.getDetails()) {
                    if (d.getMaterial() == null) {
                        throw new RuntimeException("Có dòng vật tư chưa có material_id. Không thể xuất.");
                    }

                    Material m = d.getMaterial();
                    BigDecimal need = nvl(d.getQtyRequested());

                    // allocate FEFO
                    List<InventoryCard> availableLots = inventoryCardRepository.findAvailableLotsLatestByMaterial(m.getId());
                    Map<String, BigDecimal> allocation = allocateFEFO(availableLots, need);

                    // persist out movements
                    writeInventoryOutMovements(req, m, allocation, issueDate, warehouseName);

                    IssueDetail det = buildIssueDetailLine(header, m, need, need);
                    details.add(det);
                }
            } else {
                // manual lines required
                Map<Long, ManualIssueLineDTO> manualMap = mapManualLines(request.getManualLines());

                // must cover all materials in request
                for (Map.Entry<Long, BigDecimal> e : reqQtyByMaterial.entrySet()) {
                    Long materialId = e.getKey();
                    BigDecimal need = e.getValue();

                    ManualIssueLineDTO manualLine = manualMap.get(materialId);
                    if (manualLine == null) {
                        throw new RuntimeException("Thiếu cấu hình lô thủ công cho materialId=" + materialId);
                    }

                    BigDecimal qtyIssued = nvl(manualLine.getQtyIssued());
                    if (qtyIssued.compareTo(need) != 0) {
                        throw new RuntimeException("Số lượng xuất thủ công phải đúng bằng số lượng yêu cầu (materialId=" + materialId + ")");
                    }

                    Material m = req.getDetails().stream()
                            .filter(d -> d.getMaterial() != null && d.getMaterial().getId().equals(materialId))
                            .findFirst()
                            .map(IssueReqDetail::getMaterial)
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy material trong phiếu xin lĩnh: " + materialId));

                    Map<String, BigDecimal> allocation = validateAndBuildManualAllocation(manualLine);
                    writeInventoryOutMovements(req, m, allocation, issueDate, warehouseName);

                    IssueDetail det = buildIssueDetailLine(header, m, need, qtyIssued);
                    details.add(det);
                }
            }

            details = issueDetailRepository.saveAll(details);
            header.setDetails(details);

            // 3) Recalc totals
            BigDecimal totalAmount = details.stream()
                    .map(IssueDetail::getTotal)
                    .map(IssueService::nvl)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);

            header.setTotalAmount(totalAmount);
            header = issueHeaderRepository.save(header);

            IssueHeaderDTO headerDTO = toIssueHeaderDTO(header);
            Map<String, Object> summary = buildIssueSummary(details);

            return IssueResponseDTO.success("Xuất kho thành công", headerDTO, headerDTO.getDetails(), summary);

        } catch (Exception e) {
            return IssueResponseDTO.error("Lỗi khi xuất kho: " + e.getMessage());
        }
    }

    public IssueResponseDTO getIssueDetail(Long issueId, Long userId) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!user.isApproved()) {
                throw new RuntimeException("Tài khoản chưa được kích hoạt");
            }

            IssueHeader header = issueHeaderRepository.findById(issueId)
                    .orElseThrow(() -> new RuntimeException("Phiếu xuất không tồn tại"));

            if (!(user.isThuKho() || user.isLanhDao() || user.isBanGiamHieu())) {
                throw new RuntimeException("Bạn không có quyền xem phiếu xuất");
            }

            List<IssueDetail> details = issueDetailRepository.findByHeaderId(issueId);
            header.setDetails(details);

            IssueHeaderDTO headerDTO = toIssueHeaderDTO(header);
            Map<String, Object> summary = buildIssueSummary(details);

            return IssueResponseDTO.success("Lấy chi tiết phiếu xuất thành công", headerDTO, headerDTO.getDetails(), summary);

        } catch (Exception e) {
            return IssueResponseDTO.error("Không thể tải phiếu xuất: " + e.getMessage());
        }
    }

    public List<LotStockDTO> getAvailableLotsForMaterial(Long materialId, Long thuKhoId) {
        // helper cho UI chọn lô thủ công
        validateThuKho(thuKhoId);
        List<InventoryCard> lots = inventoryCardRepository.findAvailableLotsLatestByMaterial(materialId);
        return lots.stream().map(ic -> {
            LotStockDTO dto = new LotStockDTO();
            dto.setLotNumber(ic.getLotNumber());
            dto.setMfgDate(ic.getMfgDate());
            dto.setExpDate(ic.getExpDate());
            dto.setAvailableStock(nvl(ic.getClosingStock()));
            dto.setQtyOut(BigDecimal.ZERO);
            return dto;
        }).collect(Collectors.toList());
    }

    // ------------------------- CORE LOGIC -------------------------

    private void ensureNotIssuedYet(IssueReqHeader req) {
        String marker = "IssueReq#" + req.getId();
        if (issueHeaderRepository.existsByReceiverMarker(marker)) {
            throw new RuntimeException("Phiếu xin lĩnh #" + req.getId() + " đã được xuất kho trước đó");
        }
    }

    private Map<String, BigDecimal> allocateFEFO(List<InventoryCard> availableLots, BigDecimal need) {
        BigDecimal remaining = nvl(need);
        Map<String, BigDecimal> allocation = new LinkedHashMap<>();

        for (InventoryCard lotCard : availableLots) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

            BigDecimal stock = nvl(lotCard.getClosingStock());
            if (stock.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal take = stock.min(remaining);
            allocation.put(lotCard.getLotNumber(), take);
            remaining = remaining.subtract(take);
        }

        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal available = availableLots.stream()
                    .map(InventoryCard::getClosingStock)
                    .map(IssueService::nvl)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            throw new RuntimeException("Không đủ tồn để xuất (cần " + need + ", còn " + available + ")");
        }

        return allocation;
    }

    private void writeInventoryOutMovements(IssueReqHeader req,
                                            Material material,
                                            Map<String, BigDecimal> allocation,
                                            LocalDate issueDate,
                                            String fallbackWarehouseName) {

        for (Map.Entry<String, BigDecimal> e : allocation.entrySet()) {
            String lot = safeTrim(e.getKey());
            BigDecimal qtyOut = nvl(e.getValue());

            if (lot.isEmpty()) throw new RuntimeException("LotNumber không hợp lệ");
            if (qtyOut.compareTo(BigDecimal.ZERO) <= 0) continue;

            // lock latest card for this lot
            InventoryCard latest = inventoryCardRepository
                    .lockLatestByMaterialAndLot(material.getId(), lot)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy thẻ kho cho lô " + lot));

            BigDecimal opening = nvl(latest.getClosingStock());
            if (opening.compareTo(qtyOut) < 0) {
                throw new RuntimeException("Lô " + lot + " không đủ tồn (còn " + opening + ", cần " + qtyOut + ")");
            }

            InventoryCard out = new InventoryCard();
            out.setMaterial(material);
            out.setUnit(material.getUnit());

            String wh = safeTrim(latest.getWarehouseName());
            out.setWarehouseName(wh.isEmpty() ? fallbackWarehouseName : wh);

            out.setRecordDate(issueDate);
            out.setOpeningStock(opening);
            out.setQtyIn(BigDecimal.ZERO);
            out.setQtyOut(qtyOut);

            out.setSupplier(latest.getSupplier());
            out.setLotNumber(lot);
            out.setMfgDate(latest.getMfgDate());
            out.setExpDate(latest.getExpDate());

            // gắn nguồn nhu cầu để trace (không đổi schema)
            out.setSubDepartment(req.getSubDepartment());

            inventoryCardRepository.save(out);
        }
    }

    private IssueDetail buildIssueDetailLine(IssueHeader header, Material m,
                                             BigDecimal qtyRequested, BigDecimal qtyIssued) {
        IssueDetail det = new IssueDetail();
        det.setHeader(header);
        det.setMaterial(m);

        det.setName(m.getName());
        det.setSpec(m.getSpec());
        det.setCode(m.getCode());
        det.setUnit(m.getUnit());

        BigDecimal unitPrice = findLatestUnitPrice(m.getId());
        det.setUnitPrice(unitPrice);

        det.setQtyRequested(nvl(qtyRequested));
        det.setQtyIssued(nvl(qtyIssued));

        BigDecimal total = unitPrice.multiply(nvl(qtyIssued))
                .setScale(2, RoundingMode.HALF_UP);
        det.setTotal(total);

        return det;
    }

    private BigDecimal findLatestUnitPrice(Long materialId) {
        // lấy giá nhập gần nhất (tham khảo), nếu chưa có thì 0
        return receiptDetailRepository.findLatestByMaterialId(materialId, PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .map(ReceiptDetail::getPrice)
                .map(IssueService::nvl)
                .orElse(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private List<LotStockDTO> buildAutoAllocationPreview(List<InventoryCard> availableLots, BigDecimal need) {
        BigDecimal remaining = nvl(need);
        List<LotStockDTO> lots = new ArrayList<>();

        for (InventoryCard ic : availableLots) {
            LotStockDTO dto = new LotStockDTO();
            dto.setLotNumber(ic.getLotNumber());
            dto.setMfgDate(ic.getMfgDate());
            dto.setExpDate(ic.getExpDate());
            dto.setAvailableStock(nvl(ic.getClosingStock()));

            BigDecimal take = BigDecimal.ZERO;
            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                take = nvl(ic.getClosingStock()).min(remaining);
                remaining = remaining.subtract(take);
            }
            dto.setQtyOut(take);

            lots.add(dto);
        }
        return lots;
    }

    // ------------------------- DTO MAPPERS -------------------------

    private IssueHeaderDTO toIssueHeaderDTO(IssueHeader header) {
        IssueHeaderDTO dto = new IssueHeaderDTO();
        dto.setId(header.getId());

        if (header.getCreatedBy() != null) {
            dto.setCreatedById(header.getCreatedBy().getId());
            dto.setCreatedByName(header.getCreatedBy().getFullName());
        }

        dto.setReceiverName(header.getReceiverName());

        if (header.getDepartment() != null) {
            dto.setDepartmentId(header.getDepartment().getId());
            dto.setDepartmentName(header.getDepartment().getName());
        }

        dto.setIssueDate(header.getIssueDate());
        dto.setTotalAmount(header.getTotalAmount());

        List<IssueDetail> details = header.getDetails() != null ? header.getDetails()
                : issueDetailRepository.findByHeaderId(header.getId());

        dto.setDetails(details.stream().map(this::toIssueDetailDTO).collect(Collectors.toList()));
        return dto;
    }

    private IssueDetailDTO toIssueDetailDTO(IssueDetail d) {
        IssueDetailDTO dto = new IssueDetailDTO();
        dto.setId(d.getId());

        if (d.getMaterial() != null) dto.setMaterialId(d.getMaterial().getId());
        dto.setName(d.getName());
        dto.setSpec(d.getSpec());
        dto.setCode(d.getCode());

        if (d.getUnit() != null) {
            dto.setUnitId(d.getUnit().getId());
            dto.setUnitName(d.getUnit().getName());
        }

        dto.setUnitPrice(d.getUnitPrice());
        dto.setQtyRequested(d.getQtyRequested());
        dto.setQtyIssued(d.getQtyIssued());
        dto.setTotal(d.getTotal());
        return dto;
    }

    private IssueReqHeaderDTO toIssueReqDTO(IssueReqHeader header) {
        // mapper tối thiểu đủ cho preview UI
        IssueReqHeaderDTO dto = new IssueReqHeaderDTO();
        dto.setId(header.getId());

        if (header.getCreatedBy() != null) {
            dto.setCreatedById(header.getCreatedBy().getId());
            dto.setCreatedByName(header.getCreatedBy().getFullName());
            dto.setCreatedByEmail(header.getCreatedBy().getEmail());
        }

        if (header.getSubDepartment() != null) {
            dto.setSubDepartmentId(header.getSubDepartment().getId());
            dto.setSubDepartmentName(header.getSubDepartment().getName());
        }

        if (header.getDepartment() != null) {
            dto.setDepartmentId(header.getDepartment().getId());
            dto.setDepartmentName(header.getDepartment().getName());
        }

        dto.setRequestedAt(header.getRequestedAt());
        dto.setStatus(header.getStatus());
        dto.setStatusName(header.getStatusName());
        dto.setStatusBadge(header.getStatusBadge());

        if (header.getApprovalBy() != null) {
            dto.setApprovalById(header.getApprovalBy().getId());
            dto.setApprovalByName(header.getApprovalBy().getFullName());
        }

        dto.setApprovalAt(header.getApprovalAt());
        dto.setApprovalNote(header.getApprovalNote());
        dto.setNote(header.getNote());

        List<IssueReqDetailDTO> detailDTOs = header.getDetails().stream().map(d -> {
            IssueReqDetailDTO x = new IssueReqDetailDTO();
            x.setId(d.getId());
            x.setQtyRequested(d.getQtyRequested());
            x.setCategory(d.getMaterialCategory());
            x.setIsNewMaterial(d.getMaterial() == null);

            if (d.getMaterial() != null) {
                x.setMaterialId(d.getMaterial().getId());
                x.setMaterialName(d.getMaterial().getName());
                x.setSpec(d.getMaterial().getSpec());
                if (d.getMaterial().getUnit() != null) {
                    x.setUnitId(d.getMaterial().getUnit().getId());
                    x.setUnitName(d.getMaterial().getUnit().getName());
                }
            } else {
                x.setMaterialName(d.getMaterialName());
                x.setSpec(d.getSpec());
                if (d.getUnit() != null) {
                    x.setUnitId(d.getUnit().getId());
                    x.setUnitName(d.getUnit().getName());
                }
            }
            return x;
        }).collect(Collectors.toList());

        dto.setDetails(detailDTOs);
        return dto;
    }

    // ------------------------- VALIDATIONS & HELPERS -------------------------

    private User validateThuKho(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));
        if (!u.isApproved()) throw new RuntimeException("Tài khoản chưa được kích hoạt");
        if (!u.isThuKho()) throw new RuntimeException("Chỉ thủ kho được thao tác xuất kho");
        return u;
    }

    private void validateCreateIssueRequest(CreateIssueFromReqDTO request) {
        if (request == null) throw new RuntimeException("Request không hợp lệ");
        if (request.getIssueReqId() == null) throw new RuntimeException("Thiếu issueReqId");

        boolean auto = request.getAutoAllocate() == null || request.getAutoAllocate();
        if (!auto) {
            if (request.getManualLines() == null || request.getManualLines().isEmpty()) {
                throw new RuntimeException("Chế độ thủ công cần manualLines");
            }
        }
    }

    private Map<Long, ManualIssueLineDTO> mapManualLines(List<ManualIssueLineDTO> lines) {
        Map<Long, ManualIssueLineDTO> map = new HashMap<>();
        for (ManualIssueLineDTO l : lines) {
            if (l.getMaterialId() == null) throw new RuntimeException("manualLines thiếu materialId");
            map.put(l.getMaterialId(), l);
        }
        return map;
    }

    private Map<String, BigDecimal> validateAndBuildManualAllocation(ManualIssueLineDTO line) {
        if (line.getLots() == null || line.getLots().isEmpty()) {
            throw new RuntimeException("Chưa chọn lô cho materialId=" + line.getMaterialId());
        }

        Map<String, BigDecimal> allocation = new LinkedHashMap<>();
        BigDecimal sum = BigDecimal.ZERO;

        for (ManualLotAllocationDTO l : line.getLots()) {
            String lot = safeTrim(l.getLotNumber());
            BigDecimal qty = nvl(l.getQtyOut());

            if (lot.isEmpty()) throw new RuntimeException("lotNumber không hợp lệ");
            if (qty.compareTo(BigDecimal.ZERO) <= 0) continue;

            allocation.merge(lot, qty, BigDecimal::add);
            sum = sum.add(qty);
        }

        if (sum.compareTo(nvl(line.getQtyIssued())) != 0) {
            throw new RuntimeException("Tổng số lượng theo lô phải bằng qtyIssued (materialId=" + line.getMaterialId() + ")");
        }

        return allocation;
    }

    private Map<String, Object> buildIssueSummary(List<IssueDetail> details) {
        Map<String, Object> summary = new HashMap<>();
        summary.put("totalLines", details.size());

        BigDecimal totalQty = details.stream()
                .map(IssueDetail::getQtyIssued)
                .map(IssueService::nvl)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        summary.put("totalQuantity", totalQty);

        BigDecimal totalAmount = details.stream()
                .map(IssueDetail::getTotal)
                .map(IssueService::nvl)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        summary.put("totalAmount", totalAmount);

        return summary;
    }

    private String buildDefaultReceiverName(IssueReqHeader req) {
        if (req.getSubDepartment() != null) return req.getSubDepartment().getName();
        if (req.getDepartment() != null) return req.getDepartment().getName();
        return "Đơn vị nhận";
    }

    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String safeTrim(String s) {
        return s == null ? "" : s.trim();
    }

    public EligibleIssueReqListResponseDTO getEligibleApprovedRequests(Long thuKhoId,
                                                                       Long departmentId,
                                                                       Long subDepartmentId,
                                                                       Integer limit) {
        try {
            validateThuKho(thuKhoId);

            int size = (limit == null || limit <= 0) ? 50 : Math.min(limit, 200);

            List<IssueReqHeader> approved;
            if (departmentId != null && subDepartmentId != null) {
                approved = issueReqHeaderRepository
                        .findByDepartmentIdAndSubDepartmentIdAndStatusOrderByRequestedAtAsc(
                                departmentId, subDepartmentId, 1, PageRequest.of(0, size)
                        );
            } else if (departmentId != null) {
                approved = issueReqHeaderRepository
                        .findByDepartmentIdAndStatusOrderByRequestedAtAsc(
                                departmentId, 1, PageRequest.of(0, size)
                        );
            } else {
                approved = issueReqHeaderRepository
                        .findByStatusOrderByRequestedAtAsc(1, PageRequest.of(0, size));
            }

            // Virtual stock cache: materialId -> list lot state (FEFO order)
            Map<Long, List<LotState>> lotCache = new HashMap<>();

            List<IssueReqHeaderDTO> eligible = new ArrayList<>();

            int checked = 0;
            int alreadyIssued = 0;
            int hasUnmappedMaterial = 0;
            int notEnoughStock = 0;

            for (IssueReqHeader req : approved) {
                checked++;

                // đã xuất trước đó? (marker receiver_name)
                if (isAlreadyIssued(req)) {
                    alreadyIssued++;
                    continue;
                }

                // Nếu có dòng material == null -> không thể xuất
                boolean anyNullMaterial = req.getDetails().stream().anyMatch(d -> d.getMaterial() == null);
                if (anyNullMaterial) {
                    hasUnmappedMaterial++;
                    continue;
                }

                // thử allocate toàn bộ request với virtual stock (FEFO)
                AllocationAttempt attempt = tryAllocateWholeRequest(req, lotCache);
                if (!attempt.success) {
                    notEnoughStock++;
                    continue;
                }

                // commit allocation (đã commit ngay trong tryAllocateWholeRequest)
                eligible.add(toIssueReqDTO(req));
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("checked", checked);
            summary.put("eligible", eligible.size());
            summary.put("skippedAlreadyIssued", alreadyIssued);
            summary.put("skippedHasNewOrUnmappedMaterial", hasUnmappedMaterial);
            summary.put("skippedNotEnoughStock", notEnoughStock);

            String msg = eligible.isEmpty()
                    ? "Không có phiếu nào đủ điều kiện để xuất"
                    : "Lấy danh sách phiếu đủ điều kiện để xuất thành công";

            return EligibleIssueReqListResponseDTO.success(msg, eligible, summary);

        } catch (Exception e) {
            return EligibleIssueReqListResponseDTO.error("Không thể lấy danh sách eligible: " + e.getMessage());
        }
    }

// ------------------- helpers for eligible -------------------

    private boolean isAlreadyIssued(IssueReqHeader req) {
        String marker = "IssueReq#" + req.getId();
        return issueHeaderRepository.existsByReceiverMarker(marker);
    }

    private AllocationAttempt tryAllocateWholeRequest(IssueReqHeader req,
                                                      Map<Long, List<LotState>> lotCache) {

        // Track deductions to rollback if fail
        List<Deduction> deductions = new ArrayList<>();

        for (IssueReqDetail d : req.getDetails()) {
            Material m = d.getMaterial();
            BigDecimal need = nvl(d.getQtyRequested());

            if (need.compareTo(BigDecimal.ZERO) <= 0) continue;

            List<LotState> lots = lotCache.computeIfAbsent(m.getId(), materialId -> {
                List<InventoryCard> available = inventoryCardRepository.findAvailableLotsLatestByMaterial(materialId);
                List<LotState> states = new ArrayList<>();
                for (InventoryCard ic : available) {
                    states.add(new LotState(
                            safeTrim(ic.getLotNumber()),
                            nvl(ic.getClosingStock()),
                            ic.getExpDate(),
                            ic.getMfgDate()
                    ));
                }
                return states;
            });

            BigDecimal remaining = need;

            for (int i = 0; i < lots.size(); i++) {
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

                LotState lot = lots.get(i);
                if (lot.remaining.compareTo(BigDecimal.ZERO) <= 0) continue;

                BigDecimal take = lot.remaining.min(remaining);
                if (take.compareTo(BigDecimal.ZERO) <= 0) continue;

                lot.remaining = lot.remaining.subtract(take);
                remaining = remaining.subtract(take);

                deductions.add(new Deduction(m.getId(), i, take));
            }

            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                // rollback
                rollbackDeductions(lotCache, deductions);
                return AllocationAttempt.fail();
            }
        }

        return AllocationAttempt.ok();
    }

    private void rollbackDeductions(Map<Long, List<LotState>> lotCache, List<Deduction> deductions) {
        for (Deduction d : deductions) {
            List<LotState> lots = lotCache.get(d.materialId);
            if (lots == null) continue;
            if (d.lotIndex < 0 || d.lotIndex >= lots.size()) continue;
            lots.get(d.lotIndex).remaining = lots.get(d.lotIndex).remaining.add(d.qty);
        }
    }

    private static class LotState {
        String lotNumber;
        BigDecimal remaining;
        java.time.LocalDate expDate;
        java.time.LocalDate mfgDate;

        LotState(String lotNumber, BigDecimal remaining, java.time.LocalDate expDate, java.time.LocalDate mfgDate) {
            this.lotNumber = lotNumber;
            this.remaining = remaining;
            this.expDate = expDate;
            this.mfgDate = mfgDate;
        }
    }

    private static class Deduction {
        Long materialId;
        int lotIndex;
        BigDecimal qty;

        Deduction(Long materialId, int lotIndex, BigDecimal qty) {
            this.materialId = materialId;
            this.lotIndex = lotIndex;
            this.qty = qty;
        }
    }

    private static class AllocationAttempt {
        boolean success;

        static AllocationAttempt ok() {
            AllocationAttempt a = new AllocationAttempt();
            a.success = true;
            return a;
        }

        static AllocationAttempt fail() {
            AllocationAttempt a = new AllocationAttempt();
            a.success = false;
            return a;
        }
    }

    public EligibleIssueReqResponseDTO getEligibleApprovedRequestsWithReasons(Long thuKhoId,
                                                                              Long departmentId,
                                                                              Long subDepartmentId,
                                                                              Integer limit) {
        try {
            validateThuKho(thuKhoId);

            int size = (limit == null || limit <= 0) ? 50 : Math.min(limit, 200);

            List<IssueReqHeader> approved;
            if (departmentId != null && subDepartmentId != null) {
                approved = issueReqHeaderRepository
                        .findByDepartmentIdAndSubDepartmentIdAndStatusOrderByRequestedAtAsc(
                                departmentId, subDepartmentId, 1, PageRequest.of(0, size)
                        );
            } else if (departmentId != null) {
                approved = issueReqHeaderRepository
                        .findByDepartmentIdAndStatusOrderByRequestedAtAsc(
                                departmentId, 1, PageRequest.of(0, size)
                        );
            } else {
                approved = issueReqHeaderRepository
                        .findByStatusOrderByRequestedAtAsc(1, PageRequest.of(0, size));
            }

            // Virtual stock cache: materialId -> lots remaining (FEFO order)
            Map<Long, List<LotState>> lotCache = new HashMap<>();

            List<IssueReqHeaderDTO> eligible = new ArrayList<>();
            List<IneligibleIssueReqDTO> ineligible = new ArrayList<>();

            int checked = 0;
            int rejectedAlreadyIssued = 0;
            int rejectedUnmapped = 0;
            int rejectedNotEnough = 0;

            for (IssueReqHeader req : approved) {
                checked++;

                IssueReqHeaderDTO reqDTO = toIssueReqDTO(req);

                // 1) already issued?
                if (isAlreadyIssued(req)) {
                    rejectedAlreadyIssued++;
                    ineligible.add(IneligibleIssueReqDTO.of(
                            reqDTO,
                            "ALREADY_ISSUED",
                            "Phiếu đã được xuất kho trước đó",
                            null,
                            null
                    ));
                    continue;
                }

                // 2) unmapped/new material lines?
                List<String> unmappedItems = collectUnmappedItems(req);
                if (!unmappedItems.isEmpty()) {
                    rejectedUnmapped++;
                    ineligible.add(IneligibleIssueReqDTO.of(
                            reqDTO,
                            "HAS_UNMAPPED_MATERIAL",
                            "Có vật tư chưa được map material_id (vật tư mới/chưa duyệt tạo mã). Không thể xuất.",
                            null,
                            unmappedItems
                    ));
                    continue;
                }

                // 3) compute shortages using CURRENT virtual stock (after previous eligible deductions)
                Map<Long, MaterialNeed> needs = buildNeedByMaterial(req);
                List<StockShortageDTO> shortages = computeShortages(needs, lotCache);

                if (!shortages.isEmpty()) {
                    rejectedNotEnough++;
                    ineligible.add(IneligibleIssueReqDTO.of(
                            reqDTO,
                            "NOT_ENOUGH_STOCK",
                            "Không đủ tồn kho để đáp ứng phiếu theo thứ tự ưu tiên (requested_at tăng dần).",
                            shortages,
                            null
                    ));
                    continue;
                }

                // 4) commit deduction (reserve stock virtually for later requests)
                deductForRequest(needs, lotCache);

                eligible.add(reqDTO);
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("checked", checked);
            summary.put("eligible", eligible.size());
            summary.put("ineligible", ineligible.size());
            summary.put("rejectedAlreadyIssued", rejectedAlreadyIssued);
            summary.put("rejectedHasUnmappedMaterial", rejectedUnmapped);
            summary.put("rejectedNotEnoughStock", rejectedNotEnough);

            String msg = eligible.isEmpty()
                    ? "Không có phiếu nào đủ điều kiện để xuất"
                    : "Lấy danh sách + lý do bị loại thành công";

            return EligibleIssueReqResponseDTO.success(msg, eligible, ineligible, summary);

        } catch (Exception e) {
            return EligibleIssueReqResponseDTO.error("Không thể lấy eligible: " + e.getMessage());
        }
    }

// ------------------- helpers for eligible-with-reasons -------------------

    private Map<Long, MaterialNeed> buildNeedByMaterial(IssueReqHeader req) {
        Map<Long, MaterialNeed> map = new LinkedHashMap<>();
        for (IssueReqDetail d : req.getDetails()) {
            if (d.getMaterial() == null) continue;
            Material m = d.getMaterial();
            BigDecimal qty = nvl(d.getQtyRequested());
            if (qty.compareTo(BigDecimal.ZERO) <= 0) continue;

            MaterialNeed need = map.computeIfAbsent(m.getId(), k -> new MaterialNeed(m));
            need.need = need.need.add(qty);
        }
        return map;
    }

    private List<StockShortageDTO> computeShortages(Map<Long, MaterialNeed> needs,
                                                    Map<Long, List<LotState>> lotCache) {
        List<StockShortageDTO> shortages = new ArrayList<>();

        for (MaterialNeed mn : needs.values()) {
            Long materialId = mn.material.getId();

            List<LotState> lots = lotCache.computeIfAbsent(materialId, this::loadLotStates);
            BigDecimal available = lots.stream()
                    .map(ls -> nvl(ls.remaining))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (available.compareTo(mn.need) < 0) {
                BigDecimal missing = mn.need.subtract(available);

                String unitName = (mn.material.getUnit() != null) ? mn.material.getUnit().getName() : null;
                shortages.add(StockShortageDTO.of(
                        materialId,
                        mn.material.getCode(),
                        mn.material.getName(),
                        unitName,
                        mn.need,
                        available,
                        missing
                ));
            }
        }

        return shortages;
    }

    private void deductForRequest(Map<Long, MaterialNeed> needs,
                                  Map<Long, List<LotState>> lotCache) {
        for (MaterialNeed mn : needs.values()) {
            Long materialId = mn.material.getId();
            List<LotState> lots = lotCache.computeIfAbsent(materialId, this::loadLotStates);

            BigDecimal remaining = mn.need;

            for (LotState lot : lots) {
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
                if (lot.remaining.compareTo(BigDecimal.ZERO) <= 0) continue;

                BigDecimal take = lot.remaining.min(remaining);
                lot.remaining = lot.remaining.subtract(take);
                remaining = remaining.subtract(take);
            }

            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                throw new RuntimeException("Lỗi nội bộ reserve tồn kho (materialId=" + materialId + ")");
            }
        }
    }

    private List<LotState> loadLotStates(Long materialId) {
        List<InventoryCard> available = inventoryCardRepository.findAvailableLotsLatestByMaterial(materialId);
        List<LotState> states = new ArrayList<>();
        for (InventoryCard ic : available) {
            states.add(new LotState(
                    safeTrim(ic.getLotNumber()),
                    nvl(ic.getClosingStock()),
                    ic.getExpDate(),
                    ic.getMfgDate()
            ));
        }
        return states;
    }

    private List<String> collectUnmappedItems(IssueReqHeader req) {
        List<String> out = new ArrayList<>();
        for (IssueReqDetail d : req.getDetails()) {
            if (d.getMaterial() != null) continue;

            String code = safeTrim(d.getProposedCode());
            String name = safeTrim(d.getMaterialName());
            String spec = safeTrim(d.getSpec());
            BigDecimal qty = nvl(d.getQtyRequested());

            String label;
            if (!code.isEmpty()) label = code;
            else if (!name.isEmpty()) label = name;
            else label = "Vật tư chưa map";

            if (!name.isEmpty() && !label.equals(name) && !code.isEmpty()) {
                label = label + " - " + name;
            }
            if (!spec.isEmpty()) label = label + " (" + spec + ")";
            label = label + " x " + qty;

            out.add(label);
        }
        return out;
    }

    private static class MaterialNeed {
        Material material;
        BigDecimal need;

        MaterialNeed(Material material) {
            this.material = material;
            this.need = BigDecimal.ZERO;
        }
    }
}
