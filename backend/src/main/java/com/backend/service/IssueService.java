package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class IssueService {

    private static final String DOC_APPROVED = "APPROVED";

    // Reservation status (schema mới)
    private static final String RES_ACTIVE    = "ACTIVE";
    private static final String RES_CANCELLED = "CANCELLED";
    private static final String RES_CONSUMED  = "CONSUMED";

    private static final String ISSUE_REQ_MARKER_PREFIX = "IssueReq#";

    private final IssueHeaderRepository issueHeaderRepository;
    private final IssueDetailRepository issueDetailRepository;

    private final IssueReqHeaderRepository issueReqHeaderRepository;
    private final InventoryCardRepository inventoryCardRepository;
    private final ReceiptDetailRepository receiptDetailRepository;

    private final IssueReservationRepository issueReservationRepository;
    private final ReservationStatusRepository reservationStatusRepository;

    private final UserRepository userRepository;
    private final RbacService rbacService;

    // ------------------------- API METHODS -------------------------

    /**
     * Preview xuất kho cho phiếu APPROVED.
     * Reservation-aware:
     * - Tồn khả dụng cho chính phiếu = closing - reservedOther (không trừ reservation của chính phiếu)
     * - Kế hoạch lấy theo lô: dùng phần đã giữ chỗ trước, rồi mới lấy phần baseNet.
     */
    public IssuePreviewResponseDTO previewIssueFromApprovedRequest(Long issueReqId, Long thuKhoId) {
        try {
            validateThuKho(thuKhoId);

            IssueReqHeader req = issueReqHeaderRepository.findById(issueReqId)
                    .orElseThrow(() -> new RuntimeException("Phiếu xin lĩnh không tồn tại"));

            if (!isApproved(req)) {
                throw new RuntimeException("Chỉ cho phép xuất kho với phiếu xin lĩnh đã phê duyệt");
            }

            ensureNotIssuedYet(req);

            IssueReqHeaderDTO reqDTO = toIssueReqDTO(req);

            // Reservation ACTIVE của CHÍNH phiếu này (nếu có)
            List<IssueReservation> activeResList = issueReservationRepository
                    .findByIssueReqHeader_IdAndStatus_Code(req.getId(), RES_ACTIVE);
            Map<Long, Map<String, BigDecimal>> reservedByMaterial = groupReservationsByMaterialLot(activeResList);

            // cache reserved TOTAL (ACTIVE) theo (material|lot) để tránh query lặp
            Map<String, BigDecimal> activeReservedCache = new HashMap<>();

            List<IssuePreviewLineDTO> lines = new ArrayList<>();
            List<String> missingMessages = new ArrayList<>();

            for (IssueReqDetail d : req.getDetails()) {
                if (d.getMaterial() == null) {
                    missingMessages.add("Dòng vật tư chưa có material_id (cần map vật tư trước khi xuất)");
                    continue;
                }

                Material m = d.getMaterial();
                BigDecimal need = nvl(d.getQtyRequested());
                if (need.compareTo(BigDecimal.ZERO) <= 0) continue;

                List<InventoryCard> lots = inventoryCardRepository.findAvailableLotsLatestByMaterial(m.getId());
                Map<String, BigDecimal> reservedThisByLot = reservedByMaterial.getOrDefault(m.getId(), Map.of());

                BigDecimal availableThisReq = BigDecimal.ZERO;

                for (InventoryCard ic : lots) {
                    String lot = safeTrim(ic.getLotNumber());
                    BigDecimal closing = nvl(ic.getClosingStock());

                    BigDecimal reservedTotal = getActiveReservedSum(m.getId(), lot, activeReservedCache);
                    BigDecimal reservedThis = nvl(reservedThisByLot.get(lot));
                    BigDecimal reservedOther = reservedTotal.subtract(reservedThis);
                    if (reservedOther.compareTo(BigDecimal.ZERO) < 0) reservedOther = BigDecimal.ZERO;

                    BigDecimal netForThisReq = closing.subtract(reservedOther);
                    if (netForThisReq.compareTo(BigDecimal.ZERO) > 0) {
                        availableThisReq = availableThisReq.add(netForThisReq);
                    }
                }

                if (availableThisReq.compareTo(need) < 0) {
                    missingMessages.add("Thiếu tồn (đã trừ giữ chỗ phiếu khác) cho " + m.getCode() + " - " + m.getName()
                            + " (cần " + need + ", còn " + availableThisReq + ")");
                }

                List<LotStockDTO> lotDTOs = buildAutoAllocationPreviewWithReservations(
                        m.getId(), lots, need, reservedThisByLot, activeReservedCache
                );

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
            summary.put("hasActiveReservations", !activeResList.isEmpty());
            summary.put("note", "availableStock đã trừ giữ chỗ phiếu khác; reservation của chính phiếu được cộng lại để preview đúng");

            if (!missingMessages.isEmpty()) {
                return IssuePreviewResponseDTO.success("Phiếu đã duyệt nhưng chưa đủ tồn để xuất", reqDTO, lines, summary);
            }

            return IssuePreviewResponseDTO.success("Preview xuất kho (FEFO, trừ giữ chỗ phiếu khác) thành công", reqDTO, lines, summary);

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

            if (!isApproved(req)) {
                throw new RuntimeException("Chỉ cho phép xuất kho với phiếu xin lĩnh đã phê duyệt");
            }

            ensureNotIssuedYet(req);

            // Không cho xuất nếu còn dòng chưa map material_id
            boolean anyNullMaterial = req.getDetails().stream().anyMatch(d -> d.getMaterial() == null);
            if (anyNullMaterial) {
                throw new RuntimeException("Có dòng vật tư chưa có material_id. Không thể xuất.");
            }

            LocalDate issueDate = request.getIssueDate() != null ? request.getIssueDate() : LocalDate.now();
            String warehouseName = safeTrim(request.getWarehouseName());
            if (warehouseName.isEmpty()) warehouseName = "Kho chính";

            boolean auto = (request.getAutoAllocate() == null) || request.getAutoAllocate();

            // Gom nhu cầu theo material để tránh double-allocate nếu phiếu có nhiều dòng cùng material
            Map<Long, BigDecimal> needByMaterial = req.getDetails().stream()
                    .filter(d -> d.getMaterial() != null)
                    .collect(Collectors.toMap(
                            d -> d.getMaterial().getId(),
                            d -> nvl(d.getQtyRequested()),
                            BigDecimal::add,
                            LinkedHashMap::new
                    ));

            // Active reservations của chính phiếu (nếu có)
            List<IssueReservation> activeResList = issueReservationRepository
                    .findByIssueReqHeader_IdAndStatus_Code(req.getId(), RES_ACTIVE);

            Map<Long, Map<String, BigDecimal>> reservedByMaterial = groupReservationsByMaterialLot(activeResList);

            boolean hasActiveReservations = !activeResList.isEmpty();
            boolean useReservedAllocation = false;

            if (auto && hasActiveReservations) {
                // chỉ dùng reservation nếu nó cover đúng nhu cầu theo material
                if (reservationsCoverNeed(needByMaterial, reservedByMaterial)) {
                    useReservedAllocation = true;
                } else {
                    // reservation không khớp => cancel để tránh “kẹt tồn”
                    cancelReservations(activeResList, "AUTO_ALLOCATE_REFRESH", thuKho);
                    reservedByMaterial = new HashMap<>();
                    hasActiveReservations = false;
                }
            }

            if (!auto && hasActiveReservations) {
                // manual chọn lô khác => cancel reservation cũ để tránh kẹt
                cancelReservations(activeResList, "MANUAL_OVERRIDE", thuKho);
                reservedByMaterial = new HashMap<>();
                hasActiveReservations = false;
            }

            IssueHeader header = new IssueHeader();
            header.setCreatedBy(thuKho);
            header.setIssueDate(issueDate);
            header.setDepartment(req.getDepartment());

            // IMPORTANT: link issue_header -> issue_req_header (để trace + chống xuất trùng bằng FK)
            header.setIssueReq(req);

            String receiver = safeTrim(request.getReceiverName());
            if (receiver.isEmpty()) receiver = buildDefaultReceiverName(req);

            // marker để chống xuất trùng (có ngoặc để tránh substring IssueReq#1 match IssueReq#12)
            receiver = receiver + " " + buildIssueReqMarker(req.getId());
            header.setReceiverName(receiver);
            header.setTotalAmount(BigDecimal.ZERO);

            header = issueHeaderRepository.save(header);

            // cache reserved TOTAL (ACTIVE) theo (material|lot)
            Map<String, BigDecimal> activeReservedCache = new HashMap<>();

            // 1) Ghi inventory_card qty_out theo lô
            if (auto) {
                for (Map.Entry<Long, BigDecimal> e : needByMaterial.entrySet()) {
                    Long materialId = e.getKey();
                    BigDecimal need = nvl(e.getValue());
                    if (need.compareTo(BigDecimal.ZERO) <= 0) continue;

                    Material m = req.getDetails().stream()
                            .map(IssueReqDetail::getMaterial)
                            .filter(Objects::nonNull)
                            .filter(x -> x.getId().equals(materialId))
                            .findFirst()
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy materialId=" + materialId));

                    Map<String, BigDecimal> allocation;
                    Map<String, BigDecimal> reservedThisMaterial = reservedByMaterial.getOrDefault(materialId, Map.of());

                    if (useReservedAllocation) {
                        allocation = new LinkedHashMap<>(reservedThisMaterial);
                    } else {
                        List<InventoryCard> lots = inventoryCardRepository.findAvailableLotsLatestByMaterial(materialId);
                        allocation = allocateFEFOWithReservations(materialId, lots, need, activeReservedCache);
                    }

                    writeInventoryOutMovements(req, m, allocation, issueDate, warehouseName,
                            reservedThisMaterial, activeReservedCache);
                }
            } else {
                Map<Long, ManualIssueLineDTO> manualMap = mapManualLines(request.getManualLines());

                for (Map.Entry<Long, BigDecimal> e : needByMaterial.entrySet()) {
                    Long materialId = e.getKey();
                    BigDecimal need = nvl(e.getValue());
                    if (need.compareTo(BigDecimal.ZERO) <= 0) continue;

                    ManualIssueLineDTO manualLine = manualMap.get(materialId);
                    if (manualLine == null) {
                        throw new RuntimeException("Thiếu cấu hình lô thủ công cho materialId=" + materialId);
                    }

                    BigDecimal qtyIssued = nvl(manualLine.getQtyIssued());
                    if (qtyIssued.compareTo(need) != 0) {
                        throw new RuntimeException("Số lượng xuất thủ công phải đúng bằng số lượng yêu cầu (materialId=" + materialId + ")");
                    }

                    Material m = req.getDetails().stream()
                            .map(IssueReqDetail::getMaterial)
                            .filter(Objects::nonNull)
                            .filter(x -> x.getId().equals(materialId))
                            .findFirst()
                            .orElseThrow(() -> new RuntimeException("Không tìm thấy materialId=" + materialId));

                    Map<String, BigDecimal> allocation = validateAndBuildManualAllocation(manualLine);

                    writeInventoryOutMovements(req, m, allocation, issueDate, warehouseName,
                            Map.of(), activeReservedCache);
                }
            }

            // 2) Tạo issue_detail theo từng dòng của phiếu xin lĩnh (FE đang quen format này)
            for (IssueReqDetail d : req.getDetails()) {
                Material m = d.getMaterial();
                BigDecimal qty = nvl(d.getQtyRequested());
                if (qty.compareTo(BigDecimal.ZERO) <= 0) continue;

                IssueDetail det = buildIssueDetailLine(header, m, qty, qty);
                header.addDetail(det);
            }

            BigDecimal totalAmount = header.getDetails().stream()
                    .map(IssueDetail::getTotal)
                    .map(IssueService::nvl)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);

            header.setTotalAmount(totalAmount);
            header = issueHeaderRepository.save(header);

            // 3) Consume reservation nếu đang dùng reservation để xuất
            if (useReservedAllocation) {
                consumeReservations(activeResList, "ISSUED", thuKho);
            }

            List<IssueDetail> persistedDetails = issueDetailRepository.findByHeaderId(header.getId());
            IssueHeaderDTO headerDTO = toIssueHeaderDTO(header);
            headerDTO.setDetails(persistedDetails.stream().map(this::toIssueDetailDTO).collect(Collectors.toList()));

            Map<String, Object> summary = buildIssueSummary(persistedDetails);
            summary.put("useReservedAllocation", useReservedAllocation);

            return IssueResponseDTO.success("Xuất kho thành công", headerDTO, headerDTO.getDetails(), summary);

        } catch (Exception e) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
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

            if (!rbacService.hasAnyPermission(
                    user,
                    RbacService.PERM_ISSUE_CREATE,
                    RbacService.PERM_ISSUE_REQ_APPROVE,
                    RbacService.PERM_SUPP_FORECAST_APPROVE
            )) {
                throw new RuntimeException("Bạn không có quyền xem phiếu xuất");
            }

            List<IssueDetail> details = issueDetailRepository.findByHeaderId(issueId);

            IssueHeaderDTO headerDTO = toIssueHeaderDTO(header);
            headerDTO.setDetails(details.stream().map(this::toIssueDetailDTO).collect(Collectors.toList()));

            Map<String, Object> summary = buildIssueSummary(details);

            return IssueResponseDTO.success("Lấy chi tiết phiếu xuất thành công", headerDTO, headerDTO.getDetails(), summary);

        } catch (Exception e) {
            return IssueResponseDTO.error("Không thể tải phiếu xuất: " + e.getMessage());
        }
    }

    /**
     * Trả danh sách lô còn khả dụng (đã trừ TẤT CẢ reservation ACTIVE).
     * Dùng cho UI chọn lô thủ công.
     */
    public List<LotStockDTO> getAvailableLotsForMaterial(Long materialId, Long thuKhoId) {
        validateThuKho(thuKhoId);

        Map<String, BigDecimal> activeReservedCache = new HashMap<>();

        List<InventoryCard> lots = inventoryCardRepository.findAvailableLotsLatestByMaterial(materialId);
        return lots.stream().map(ic -> {
            String lot = safeTrim(ic.getLotNumber());
            BigDecimal closing = nvl(ic.getClosingStock());
            BigDecimal reserved = getActiveReservedSum(materialId, lot, activeReservedCache);
            BigDecimal net = closing.subtract(reserved);
            if (net.compareTo(BigDecimal.ZERO) < 0) net = BigDecimal.ZERO;

            LotStockDTO dto = new LotStockDTO();
            dto.setLotNumber(lot);
            dto.setMfgDate(ic.getMfgDate());
            dto.setExpDate(ic.getExpDate());
            dto.setAvailableStock(net);
            dto.setQtyOut(BigDecimal.ZERO);
            return dto;
        }).collect(Collectors.toList());
    }

    // ------------------------- CORE LOGIC -------------------------

    private boolean isApproved(IssueReqHeader req) {
        return req != null
                && req.getStatus() != null
                && req.getStatus().getCode() != null
                && DOC_APPROVED.equalsIgnoreCase(req.getStatus().getCode());
    }

    /**
     * Chống xuất trùng theo FK trước (issue_header.issue_req_id), fallback theo marker.
     * - FK check: tránh lỗi substring.
     * - Marker fallback: giữ tương thích với dữ liệu cũ đã lưu receiver_name.
     */
    private void ensureNotIssuedYet(IssueReqHeader req) {
        Long reqId = (req != null) ? req.getId() : null;
        if (reqId == null) throw new RuntimeException("Phiếu xin lĩnh không hợp lệ");

        // 1) FK check (chuẩn nhất)
        Optional<IssueHeader> byFk = issueHeaderRepository.findByIssueReqId(reqId);
        if (byFk.isPresent()) {
            throw new RuntimeException("Phiếu xin lĩnh #" + reqId + " đã được xuất kho trước đó");
        }

        // 2) Fallback marker (dữ liệu cũ)
        String marker = buildIssueReqMarker(reqId); // có ngoặc
        if (issueHeaderRepository.existsByReceiverMarker(marker)) {
            throw new RuntimeException("Phiếu xin lĩnh #" + reqId + " đã được xuất kho trước đó");
        }
    }

    private String buildIssueReqMarker(Long issueReqId) {
        return "(" + ISSUE_REQ_MARKER_PREFIX + issueReqId + ")";
    }

    /**
     * Auto FEFO allocation nhưng trừ lượng đang “giữ chỗ” (IssueReservation ACTIVE) của CÁC PHIẾU (tổng).
     * Dùng cho trường hợp không dùng reservation của chính phiếu.
     */
    private Map<String, BigDecimal> allocateFEFOWithReservations(Long materialId,
                                                                 List<InventoryCard> availableLots,
                                                                 BigDecimal need,
                                                                 Map<String, BigDecimal> activeReservedCache) {
        BigDecimal remaining = nvl(need);
        Map<String, BigDecimal> allocation = new LinkedHashMap<>();

        for (InventoryCard lotCard : availableLots) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

            String lot = safeTrim(lotCard.getLotNumber());
            BigDecimal closing = nvl(lotCard.getClosingStock());
            if (closing.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal reserved = getActiveReservedSum(materialId, lot, activeReservedCache);
            BigDecimal net = closing.subtract(reserved);
            if (net.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal take = net.min(remaining);
            if (take.compareTo(BigDecimal.ZERO) <= 0) continue;

            allocation.merge(lot, take, BigDecimal::add);
            remaining = remaining.subtract(take);
        }

        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal netAvail = BigDecimal.ZERO;
            for (InventoryCard ic : availableLots) {
                String lot = safeTrim(ic.getLotNumber());
                BigDecimal closing = nvl(ic.getClosingStock());
                BigDecimal reserved = getActiveReservedSum(materialId, lot, activeReservedCache);
                BigDecimal net = closing.subtract(reserved);
                if (net.compareTo(BigDecimal.ZERO) > 0) netAvail = netAvail.add(net);
            }
            throw new RuntimeException("Không đủ tồn để xuất (đã trừ giữ chỗ): cần " + need + ", còn " + netAvail);
        }

        return allocation;
    }

    /**
     * Ghi inventory_card OUT theo lô, đồng thời chặn không cho lấy vào phần tồn đang được giữ chỗ bởi phiếu khác.
     * reservedThisMaterial: reservation ACTIVE của chính issueReq hiện tại (chỉ dùng khi useReservedAllocation=true)
     */
    private void writeInventoryOutMovements(IssueReqHeader req,
                                            Material material,
                                            Map<String, BigDecimal> allocation,
                                            LocalDate issueDate,
                                            String fallbackWarehouseName,
                                            Map<String, BigDecimal> reservedThisMaterial,
                                            Map<String, BigDecimal> activeReservedCache) {

        Long materialId = material.getId();

        for (Map.Entry<String, BigDecimal> e : allocation.entrySet()) {
            String lot = safeTrim(e.getKey());
            BigDecimal qtyOut = nvl(e.getValue());

            if (lot.isEmpty()) throw new RuntimeException("LotNumber không hợp lệ");
            if (qtyOut.compareTo(BigDecimal.ZERO) <= 0) continue;

            InventoryCard latest = inventoryCardRepository
                    .lockLatestByMaterialAndLot(materialId, lot)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy thẻ kho cho lô " + lot));

            BigDecimal opening = nvl(latest.getClosingStock());

            // Chặn lấy phần tồn đang được giữ chỗ bởi phiếu khác
            BigDecimal reservedTotal = getActiveReservedSum(materialId, lot, activeReservedCache);
            BigDecimal reservedThis = nvl(reservedThisMaterial.get(lot));
            BigDecimal reservedOther = reservedTotal.subtract(reservedThis);
            if (reservedOther.compareTo(BigDecimal.ZERO) < 0) reservedOther = BigDecimal.ZERO;

            BigDecimal netAvail = opening.subtract(reservedOther);
            if (netAvail.compareTo(qtyOut) < 0) {
                throw new RuntimeException("Lô " + lot + " không đủ tồn khả dụng (đã trừ giữ chỗ phiếu khác). "
                        + "Còn " + netAvail + ", cần " + qtyOut);
            }

            InventoryCard out = new InventoryCard();
            out.setMaterial(material);
            out.setUnit(material.getUnit());

            String wh = safeTrim(latest.getWarehouseName());
            out.setWarehouseName(wh.isEmpty() ? fallbackWarehouseName : wh);

            out.setRecordDate(LocalDate.now());
            out.setOpeningStock(opening);
            out.setQtyIn(BigDecimal.ZERO);
            out.setQtyOut(qtyOut);

            out.setSupplier(latest.getSupplier());
            out.setLotNumber(lot);
            out.setMfgDate(latest.getMfgDate());
            out.setExpDate(latest.getExpDate());

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
        return receiptDetailRepository.findLatestByMaterialId(materialId, PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .map(ReceiptDetail::getPrice)
                .map(IssueService::nvl)
                .orElse(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
    }

    // ------------------------- PREVIEW LOT BUILDER -------------------------

    private List<LotStockDTO> buildAutoAllocationPreviewWithReservations(Long materialId,
                                                                         List<InventoryCard> availableLots,
                                                                         BigDecimal need,
                                                                         Map<String, BigDecimal> activeReservedCache) {
        return buildAutoAllocationPreviewWithReservations(materialId, availableLots, need, Map.of(), activeReservedCache);
    }

    /**
     * Reservation-aware preview:
     * baseNet = closing - reservedTotal (tất cả phiếu)
     * availableThisReq = baseNet + reservedThis (chỉ phiếu hiện tại)
     * qtyOut preview: dùng reservedThis trước, rồi mới dùng baseNet.
     */
    private List<LotStockDTO> buildAutoAllocationPreviewWithReservations(Long materialId,
                                                                         List<InventoryCard> availableLots,
                                                                         BigDecimal need,
                                                                         Map<String, BigDecimal> reservedThisByLot,
                                                                         Map<String, BigDecimal> activeReservedCache) {
        BigDecimal needLeft = nvl(need);
        List<LotStockDTO> lots = new ArrayList<>();

        for (InventoryCard ic : availableLots) {
            String lot = safeTrim(ic.getLotNumber());

            BigDecimal closing = nvl(ic.getClosingStock());
            BigDecimal reservedTotal = getActiveReservedSum(materialId, lot, activeReservedCache);
            BigDecimal reservedThis = nvl(reservedThisByLot.get(lot));

            BigDecimal baseNet = closing.subtract(reservedTotal);
            if (baseNet.compareTo(BigDecimal.ZERO) < 0) baseNet = BigDecimal.ZERO;

            BigDecimal availableThisReq = baseNet.add(reservedThis);

            LotStockDTO dto = new LotStockDTO();
            dto.setLotNumber(lot);
            dto.setMfgDate(ic.getMfgDate());
            dto.setExpDate(ic.getExpDate());
            dto.setAvailableStock(availableThisReq);

            BigDecimal useReserved = BigDecimal.ZERO;
            if (needLeft.compareTo(BigDecimal.ZERO) > 0 && reservedThis.compareTo(BigDecimal.ZERO) > 0) {
                useReserved = reservedThis.min(needLeft);
                needLeft = needLeft.subtract(useReserved);
            }

            BigDecimal useBase = BigDecimal.ZERO;
            if (needLeft.compareTo(BigDecimal.ZERO) > 0 && baseNet.compareTo(BigDecimal.ZERO) > 0) {
                useBase = baseNet.min(needLeft);
                needLeft = needLeft.subtract(useBase);
            }

            dto.setQtyOut(useReserved.add(useBase));
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

        List<IssueDetail> details = issueDetailRepository.findByHeaderId(header.getId());
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

        String st = (header.getStatus() != null) ? header.getStatus().getCode() : null;
        dto.setStatus("APPROVED".equalsIgnoreCase(st) ? 1 : ("REJECTED".equalsIgnoreCase(st) ? 2 : 0));
        dto.setStatusName(dto.getStatus() == 1 ? "Đã phê duyệt" : (dto.getStatus() == 2 ? "Bị từ chối" : "Chờ phê duyệt"));
        dto.setStatusBadge(dto.getStatus() == 1 ? "approved" : (dto.getStatus() == 2 ? "rejected" : "pending"));

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
            x.setCategory(toCategoryChar(d.getMaterialCategory()));
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

    private static Character toCategoryChar(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return Character.toUpperCase(t.charAt(0));
    }

    // ------------------------- VALIDATIONS & HELPERS -------------------------

    private User validateThuKho(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (!u.isApproved()) throw new RuntimeException("Tài khoản chưa được kích hoạt");

        if (!rbacService.hasPermission(u, RbacService.PERM_ISSUE_CREATE)) {
            throw new RuntimeException("Bạn không có quyền xuất kho");
        }
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
        if (lines == null) return map;

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

    private static BigDecimal sumMap(Map<String, BigDecimal> m) {
        if (m == null || m.isEmpty()) return BigDecimal.ZERO;
        BigDecimal s = BigDecimal.ZERO;
        for (BigDecimal v : m.values()) s = s.add(nvl(v));
        return s;
    }

    // ------------------------- RESERVATION HELPERS -------------------------

    private BigDecimal getActiveReservedSum(Long materialId, String lotNumber, Map<String, BigDecimal> cache) {
        String lot = safeTrim(lotNumber);
        String key = materialId + "|" + lot;
        return cache.computeIfAbsent(key, k -> {
            BigDecimal v = issueReservationRepository.sumActiveReservedByMaterialAndLot(materialId, lot);
            return v == null ? BigDecimal.ZERO : v;
        });
    }

    private Map<Long, Map<String, BigDecimal>> groupReservationsByMaterialLot(List<IssueReservation> list) {
        Map<Long, Map<String, BigDecimal>> out = new HashMap<>();
        if (list == null) return out;

        for (IssueReservation r : list) {
            if (r.getMaterial() == null) continue;
            Long mid = r.getMaterial().getId();
            String lot = safeTrim(r.getLotNumber());
            BigDecimal qty = nvl(r.getQtyReserved());
            if (qty.compareTo(BigDecimal.ZERO) <= 0) continue;

            out.computeIfAbsent(mid, x -> new LinkedHashMap<>())
                    .merge(lot, qty, BigDecimal::add);
        }
        return out;
    }

    private boolean reservationsCoverNeed(Map<Long, BigDecimal> needByMaterial,
                                          Map<Long, Map<String, BigDecimal>> reservedByMaterial) {
        for (Map.Entry<Long, BigDecimal> e : needByMaterial.entrySet()) {
            Long mid = e.getKey();
            BigDecimal need = nvl(e.getValue());

            Map<String, BigDecimal> lots = reservedByMaterial.get(mid);
            BigDecimal reserved = BigDecimal.ZERO;
            if (lots != null) {
                for (BigDecimal q : lots.values()) reserved = reserved.add(nvl(q));
            }
            if (reserved.compareTo(need) != 0) return false;
        }
        return true;
    }

    private ReservationStatus requireReservationStatus(String code) {
        return reservationStatusRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Thiếu reservation_status code=" + code));
    }

    private void cancelReservations(List<IssueReservation> active, String note, User actor) {
        if (active == null || active.isEmpty()) return;

        ReservationStatus st = requireReservationStatus(RES_CANCELLED);
        for (IssueReservation r : active) {
            r.setStatus(st);
            r.setNote(buildResNote(note, actor));
        }
        issueReservationRepository.saveAll(active);
    }

    private void consumeReservations(List<IssueReservation> active, String note, User actor) {
        if (active == null || active.isEmpty()) return;

        ReservationStatus st = requireReservationStatus(RES_CONSUMED);
        LocalDateTime now = LocalDateTime.now();

        for (IssueReservation r : active) {
            r.setStatus(st);
            r.setConsumedAt(now);
            r.setNote(buildResNote(note, actor));
        }
        issueReservationRepository.saveAll(active);
    }

    private String buildResNote(String note, User actor) {
        String n = safeTrim(note);
        String who = (actor != null) ? safeTrim(actor.getFullName()) : "";
        if (!who.isEmpty()) {
            if (!n.isEmpty()) n = n + " | ";
            n = n + "by " + who;
        }
        return n;
    }

    // ------------------------- ELIGIBLE LIST (RESERVED-AWARE) -------------------------

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
                        .findByDepartmentIdAndSubDepartmentIdAndStatus_CodeOrderByRequestedAtAsc(
                                departmentId, subDepartmentId, DOC_APPROVED, PageRequest.of(0, size)
                        );
            } else if (departmentId != null) {
                approved = issueReqHeaderRepository
                        .findByDepartmentIdAndStatus_CodeOrderByRequestedAtAsc(
                                departmentId, DOC_APPROVED, PageRequest.of(0, size)
                        );
            } else {
                approved = issueReqHeaderRepository
                        .findByStatus_CodeOrderByRequestedAtAsc(DOC_APPROVED, PageRequest.of(0, size));
            }

            Map<Long, List<LotState>> lotCache = new HashMap<>();
            Map<String, BigDecimal> activeReservedCache = new HashMap<>();

            List<IssueReqHeaderDTO> eligible = new ArrayList<>();

            int checked = 0, alreadyIssued = 0, hasUnmappedMaterial = 0, notEnoughStock = 0;

            for (IssueReqHeader req : approved) {
                checked++;

                if (isAlreadyIssued(req)) {
                    alreadyIssued++;
                    continue;
                }

                boolean anyNullMaterial = req.getDetails().stream().anyMatch(d -> d.getMaterial() == null);
                if (anyNullMaterial) {
                    hasUnmappedMaterial++;
                    continue;
                }

                List<IssueReservation> res = issueReservationRepository
                        .findByIssueReqHeader_IdAndStatus_Code(req.getId(), RES_ACTIVE);
                Map<Long, Map<String, BigDecimal>> reservedThisReq = groupReservationsByMaterialLot(res);

                AllocationAttempt attempt = tryAllocateWholeRequest(req, reservedThisReq, lotCache, activeReservedCache);
                if (!attempt.success) {
                    notEnoughStock++;
                    continue;
                }

                eligible.add(toIssueReqDTO(req));
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("checked", checked);
            summary.put("eligible", eligible.size());
            summary.put("skippedAlreadyIssued", alreadyIssued);
            summary.put("skippedHasNewOrUnmappedMaterial", hasUnmappedMaterial);
            summary.put("skippedNotEnoughStock", notEnoughStock);
            summary.put("note", "eligible đã trừ qty đang giữ chỗ (IssueReservation ACTIVE); phiếu có reservation sẽ được cộng lại phần của chính nó");

            String msg = eligible.isEmpty()
                    ? "Không có phiếu nào đủ điều kiện để xuất"
                    : "Lấy danh sách phiếu đủ điều kiện để xuất thành công";

            return EligibleIssueReqListResponseDTO.success(msg, eligible, summary);

        } catch (Exception e) {
            return EligibleIssueReqListResponseDTO.error("Không thể lấy danh sách eligible: " + e.getMessage());
        }
    }

    private boolean isAlreadyIssued(IssueReqHeader req) {
        Long reqId = (req != null) ? req.getId() : null;
        if (reqId == null) return false;

        // Prefer FK check
        if (issueHeaderRepository.findByIssueReqId(reqId).isPresent()) return true;

        // Fallback marker check (có ngoặc)
        String marker = buildIssueReqMarker(reqId);
        return issueHeaderRepository.existsByReceiverMarker(marker);
    }

    private AllocationAttempt tryAllocateWholeRequest(IssueReqHeader req,
                                                      Map<Long, Map<String, BigDecimal>> reservedThisReq,
                                                      Map<Long, List<LotState>> lotCache,
                                                      Map<String, BigDecimal> activeReservedCache) {

        List<Deduction> deductions = new ArrayList<>();

        Map<Long, MaterialNeed> needs = buildNeedByMaterial(req);

        for (MaterialNeed mn : needs.values()) {
            Long materialId = mn.material.getId();
            BigDecimal need = nvl(mn.need);
            if (need.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal reservedThisTotal = sumMap(reservedThisReq.get(materialId));
            BigDecimal needFromBase = need.subtract(reservedThisTotal);
            if (needFromBase.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            List<LotState> lots = lotCache.computeIfAbsent(materialId,
                    mid -> loadLotStatesNet(mid, activeReservedCache));

            BigDecimal remaining = needFromBase;

            for (int i = 0; i < lots.size(); i++) {
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

                LotState lot = lots.get(i);
                if (lot.remaining.compareTo(BigDecimal.ZERO) <= 0) continue;

                BigDecimal take = lot.remaining.min(remaining);
                if (take.compareTo(BigDecimal.ZERO) <= 0) continue;

                lot.remaining = lot.remaining.subtract(take);
                remaining = remaining.subtract(take);

                deductions.add(new Deduction(materialId, i, take));
            }

            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
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

    private List<LotState> loadLotStatesNet(Long materialId, Map<String, BigDecimal> activeReservedCache) {
        List<InventoryCard> available = inventoryCardRepository.findAvailableLotsLatestByMaterial(materialId);
        List<LotState> states = new ArrayList<>();

        for (InventoryCard ic : available) {
            String lot = safeTrim(ic.getLotNumber());
            BigDecimal closing = nvl(ic.getClosingStock());
            BigDecimal reserved = getActiveReservedSum(materialId, lot, activeReservedCache);
            BigDecimal net = closing.subtract(reserved);
            if (net.compareTo(BigDecimal.ZERO) <= 0) continue;

            states.add(new LotState(
                    lot,
                    net,
                    ic.getExpDate(),
                    ic.getMfgDate()
            ));
        }

        return states;
    }

    private static class LotState {
        String lotNumber;
        BigDecimal remaining;
        LocalDate expDate;
        LocalDate mfgDate;

        LotState(String lotNumber, BigDecimal remaining, LocalDate expDate, LocalDate mfgDate) {
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

    // ------------------------- ELIGIBLE + REASONS (RESERVED-AWARE) -------------------------

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
                        .findByDepartmentIdAndSubDepartmentIdAndStatus_CodeOrderByRequestedAtAsc(
                                departmentId, subDepartmentId, DOC_APPROVED, PageRequest.of(0, size)
                        );
            } else if (departmentId != null) {
                approved = issueReqHeaderRepository
                        .findByDepartmentIdAndStatus_CodeOrderByRequestedAtAsc(
                                departmentId, DOC_APPROVED, PageRequest.of(0, size)
                        );
            } else {
                approved = issueReqHeaderRepository
                        .findByStatus_CodeOrderByRequestedAtAsc(DOC_APPROVED, PageRequest.of(0, size));
            }

            Map<Long, List<LotState>> lotCache = new HashMap<>();
            Map<String, BigDecimal> activeReservedCache = new HashMap<>();

            List<IssueReqHeaderDTO> eligible = new ArrayList<>();
            List<IneligibleIssueReqDTO> ineligible = new ArrayList<>();

            int checked = 0, rejectedAlreadyIssued = 0, rejectedUnmapped = 0, rejectedNotEnough = 0;

            for (IssueReqHeader req : approved) {
                checked++;

                IssueReqHeaderDTO reqDTO = toIssueReqDTO(req);

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

                List<IssueReservation> res = issueReservationRepository
                        .findByIssueReqHeader_IdAndStatus_Code(req.getId(), RES_ACTIVE);
                Map<Long, Map<String, BigDecimal>> reservedThisReq = groupReservationsByMaterialLot(res);

                Map<Long, MaterialNeed> needs = buildNeedByMaterial(req);
                List<StockShortageDTO> shortages = computeShortages(needs, reservedThisReq, lotCache, activeReservedCache);

                if (!shortages.isEmpty()) {
                    rejectedNotEnough++;
                    ineligible.add(IneligibleIssueReqDTO.of(
                            reqDTO,
                            "NOT_ENOUGH_STOCK",
                            "Không đủ tồn kho (đã trừ giữ chỗ phiếu khác) để đáp ứng phiếu theo thứ tự ưu tiên.",
                            shortages,
                            null
                    ));
                    continue;
                }

                deductForRequest(needs, reservedThisReq, lotCache, activeReservedCache);
                eligible.add(reqDTO);
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("checked", checked);
            summary.put("eligible", eligible.size());
            summary.put("ineligible", ineligible.size());
            summary.put("rejectedAlreadyIssued", rejectedAlreadyIssued);
            summary.put("rejectedHasUnmappedMaterial", rejectedUnmapped);
            summary.put("rejectedNotEnoughStock", rejectedNotEnough);
            summary.put("note", "eligible/ineligible đã trừ qty đang giữ chỗ (IssueReservation ACTIVE); phiếu có reservation sẽ được cộng lại phần của chính nó");

            String msg = eligible.isEmpty()
                    ? "Không có phiếu nào đủ điều kiện để xuất"
                    : "Lấy danh sách + lý do bị loại thành công";

            return EligibleIssueReqResponseDTO.success(msg, eligible, ineligible, summary);

        } catch (Exception e) {
            return EligibleIssueReqResponseDTO.error("Không thể lấy eligible: " + e.getMessage());
        }
    }

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
                                                    Map<Long, Map<String, BigDecimal>> reservedThisReq,
                                                    Map<Long, List<LotState>> lotCache,
                                                    Map<String, BigDecimal> activeReservedCache) {
        List<StockShortageDTO> shortages = new ArrayList<>();

        for (MaterialNeed mn : needs.values()) {
            Long materialId = mn.material.getId();

            List<LotState> lots = lotCache.computeIfAbsent(materialId,
                    mid -> loadLotStatesNet(mid, activeReservedCache));

            BigDecimal baseAvailable = lots.stream()
                    .map(ls -> nvl(ls.remaining))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal reservedThisTotal = sumMap(reservedThisReq.get(materialId));
            BigDecimal availableForThisReq = baseAvailable.add(reservedThisTotal);

            if (availableForThisReq.compareTo(mn.need) < 0) {
                BigDecimal missing = mn.need.subtract(availableForThisReq);
                String unitName = (mn.material.getUnit() != null) ? mn.material.getUnit().getName() : null;

                shortages.add(StockShortageDTO.of(
                        materialId,
                        mn.material.getCode(),
                        mn.material.getName(),
                        unitName,
                        mn.need,
                        availableForThisReq,
                        missing
                ));
            }
        }

        return shortages;
    }

    private void deductForRequest(Map<Long, MaterialNeed> needs,
                                  Map<Long, Map<String, BigDecimal>> reservedThisReq,
                                  Map<Long, List<LotState>> lotCache,
                                  Map<String, BigDecimal> activeReservedCache) {
        for (MaterialNeed mn : needs.values()) {
            Long materialId = mn.material.getId();
            List<LotState> lots = lotCache.computeIfAbsent(materialId,
                    mid -> loadLotStatesNet(mid, activeReservedCache));

            BigDecimal reservedThisTotal = sumMap(reservedThisReq.get(materialId));
            BigDecimal needFromBase = nvl(mn.need).subtract(reservedThisTotal);
            if (needFromBase.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal remaining = needFromBase;

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
