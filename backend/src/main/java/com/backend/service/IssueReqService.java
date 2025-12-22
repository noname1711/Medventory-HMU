package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class IssueReqService {

    private static final String DOC_PENDING  = "PENDING";
    private static final String DOC_APPROVED = "APPROVED";
    private static final String DOC_REJECTED = "REJECTED";

    private static final String RES_ACTIVE    = "ACTIVE";
    private static final String RES_CANCELLED = "CANCELLED";

    private static final String AUTO_APPROVAL_NOTE = "Hệ thống tự động phê duyệt (đủ tồn, đã giữ chỗ)";

    private final IssueReqHeaderRepository headerRepository;
    private final IssueReqDetailRepository detailRepository;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final SubDepartmentRepository subDepartmentRepository;
    private final MaterialRepository materialRepository;
    private final UnitRepository unitRepository;

    private final InventoryCardRepository inventoryCardRepository;

    private final DocStatusRepository docStatusRepository;
    private final NotificationService notificationService;

    private final IssueReservationRepository issueReservationRepository;
    private final ReservationStatusRepository reservationStatusRepository;

    // ==================== DANH SÁCH PHIẾU CHO LÃNH ĐẠO ====================

    public IssueReqListResponseDTO getPendingRequestsForLeader(Long leaderId) {
        try {
            getLeaderUser(leaderId, "Chỉ lãnh đạo được xem phiếu chờ phê duyệt");

            List<IssueReqHeader> pendingRequests =
                    headerRepository.findByStatus_CodeOrderByRequestedAtDesc(DOC_PENDING);

            List<IssueReqHeaderDTO> requestDTOs = pendingRequests.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            long totalCount = headerRepository.countByStatus_Code(DOC_PENDING);
            long approvedCount = headerRepository.countByStatus_Code(DOC_APPROVED);
            long rejectedCount = headerRepository.countByStatus_Code(DOC_REJECTED);

            return IssueReqListResponseDTO.success(
                    requestDTOs.isEmpty() ? "Không có phiếu nào chờ phê duyệt" : "Lấy danh sách phiếu chờ phê duyệt thành công",
                    requestDTOs,
                    totalCount,
                    (int) totalCount,
                    (int) approvedCount,
                    (int) rejectedCount
            );

        } catch (Exception e) {
            return IssueReqListResponseDTO.success(
                    "Không có phiếu nào chờ phê duyệt",
                    new ArrayList<>(),
                    0L, 0, 0, 0
            );
        }
    }

    public IssueReqListResponseDTO getProcessedRequestsForLeader(Long leaderId) {
        try {
            getLeaderUser(leaderId, "Chỉ lãnh đạo được xem lịch sử phê duyệt");

            List<IssueReqHeader> processedRequests =
                    headerRepository.findByStatus_CodeInOrderByRequestedAtDesc(List.of(DOC_APPROVED, DOC_REJECTED));

            List<IssueReqHeaderDTO> requestDTOs = processedRequests.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            long totalCount = requestDTOs.size();
            long pendingCount = headerRepository.countByStatus_Code(DOC_PENDING);

            int approved = (int) requestDTOs.stream().filter(r -> Objects.equals(r.getStatus(), 1)).count();
            int rejected = (int) requestDTOs.stream().filter(r -> Objects.equals(r.getStatus(), 2)).count();

            return IssueReqListResponseDTO.success(
                    requestDTOs.isEmpty() ? "Chưa có lịch sử phê duyệt" : "Lấy lịch sử phiếu thành công",
                    requestDTOs,
                    totalCount,
                    (int) pendingCount,
                    approved,
                    rejected
            );

        } catch (Exception e) {
            return IssueReqListResponseDTO.success(
                    "Chưa có lịch sử phê duyệt",
                    new ArrayList<>(),
                    0L, 0, 0, 0
            );
        }
    }

    // ==================== CHI TIẾT PHIẾU ====================

    public IssueReqDetailResponseDTO getRequestDetailWithSummary(Long issueReqId, Long userId) {
        try {
            IssueReqHeader header = headerRepository.findById(issueReqId)
                    .orElseThrow(() -> new RuntimeException("Phiếu xin lĩnh không tồn tại"));

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!hasPermissionToView(header, user)) {
                return IssueReqDetailResponseDTO.error("Bạn không có quyền xem phiếu này");
            }

            IssueReqHeaderDTO headerDTO = convertToDTO(header);
            Map<String, Object> summary = createSummary(header);

            return IssueReqDetailResponseDTO.success(
                    "Lấy chi tiết phiếu thành công",
                    headerDTO,
                    headerDTO.getDetails(),
                    summary
            );

        } catch (Exception e) {
            return IssueReqDetailResponseDTO.error("Không thể tải chi tiết phiếu");
        }
    }

    // ==================== THAO TÁC PHÊ DUYỆT ====================

    public IssueReqDetailResponseDTO processApproval(ApprovalActionDTO request) {
        try {
            if (request == null || request.getIssueReqId() == null) {
                throw new RuntimeException("Thiếu issueReqId");
            }

            User approver = getLeaderUser(request.getApproverId(), "Chỉ lãnh đạo được phê duyệt phiếu");

            // Lock header để tránh 2 lãnh đạo bấm cùng lúc / auto-approve chen ngang
            IssueReqHeader header = headerRepository.lockByIdForUpdate(request.getIssueReqId());
            if (header == null) throw new RuntimeException("Phiếu xin lĩnh không tồn tại");

            if (!isDocStatus(header, DOC_PENDING)) {
                throw new RuntimeException("Phiếu này đã được xử lý");
            }

            header.setApprovalBy(approver);
            header.setApprovalAt(LocalDateTime.now());
            header.setApprovalNote(request.getNote());

            switch (request.getAction()) {
                case ApprovalActionDTO.ACTION_APPROVE: {
                    // 1) Nếu có vật tư mới nhưng proposedCode hợp lệ => tạo material để map trước
                    createNewMaterialsForApprovedRequest(header);

                    // 2) Sau khi map xong: bắt buộc phải map hết để giữ đúng invariant (APPROVED => đã giữ chỗ đủ)
                    if (hasAnyUnmappedMaterial(header)) {
                        throw new RuntimeException("Có vật tư chưa map material_id. Không thể phê duyệt.");
                    }

                    // 3) Reserve đủ toàn phiếu (FEFO, trừ reservation phiếu khác)
                    reserveStockForWholeRequestOrThrow(header, approver, "MANUAL_APPROVE");

                    // 4) APPROVED
                    header.setStatus(requireDocStatus(DOC_APPROVED));

                    notificationService.notifyApprovalResult(header, true, request.getNote());
                    break;
                }

                case ApprovalActionDTO.ACTION_REJECT: {
                    cancelActiveReservationsRejected(header, approver, request.getNote());
                    header.setStatus(requireDocStatus(DOC_REJECTED));
                    notificationService.notifyApprovalResult(header, false, request.getNote());
                    break;
                }

                case ApprovalActionDTO.ACTION_REQUEST_ADJUSTMENT: {
                    // schema không có trạng thái riêng: giữ PENDING, chỉ gửi thông báo
                    notificationService.notifyAdjustmentRequest(header, request.getNote());
                    break;
                }

                default:
                    throw new RuntimeException("Hành động không hợp lệ");
            }

            header = headerRepository.save(header);

            IssueReqHeaderDTO headerDTO = convertToDTO(header);
            Map<String, Object> summary = createSummary(header);

            String actionName = request.getActionName();
            return IssueReqDetailResponseDTO.success(
                    "Đã " + actionName.toLowerCase() + " phiếu xin lĩnh thành công",
                    headerDTO,
                    headerDTO.getDetails(),
                    summary
            );

        } catch (Exception e) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            return IssueReqDetailResponseDTO.error("Lỗi khi xử lý phê duyệt: " + e.getMessage());
        }
    }

    /**
     * Tạo mới material cho dòng vật tư (nếu material=null và proposedCode!=null).
     * Lưu ý: method này chỉ phục vụ map material_id để có thể kiểm tra tồn/giữ chỗ/xuất.
     */
    private void createNewMaterialsForApprovedRequest(IssueReqHeader header) {
        if (header == null || header.getDetails() == null) return;

        for (IssueReqDetail detail : header.getDetails()) {
            if (detail.getMaterial() == null && detail.getProposedCode() != null) {

                Material existingMaterial = materialRepository.findByCode(detail.getProposedCode());
                if (existingMaterial != null) {
                    detail.setMaterial(existingMaterial);
                } else {
                    Material newMaterial = new Material();
                    newMaterial.setName(detail.getMaterialName());
                    newMaterial.setSpec(detail.getSpec());
                    newMaterial.setCode(detail.getProposedCode());
                    newMaterial.setManufacturer(detail.getProposedManufacturer());

                    String cat = "D";
                    if (detail.getMaterialCategory() != null) {
                        cat = String.valueOf(detail.getMaterialCategory()).trim().toUpperCase();
                        if (!cat.matches("[ABCD]")) cat = "D";
                    }
                    newMaterial.setCategory(cat);

                    if (detail.getUnit() != null) {
                        newMaterial.setUnit(detail.getUnit());
                    }

                    newMaterial = materialRepository.save(newMaterial);
                    detail.setMaterial(newMaterial);
                }
            }
        }

        detailRepository.saveAll(header.getDetails());
    }

    // ==================== TẠO PHIẾU XIN LĨNH CHO CÁN BỘ ====================

    public IssueReqDetailResponseDTO createIssueRequest(CreateIssueReqDTO request, Long creatorId) {
        try {
            User creator = userRepository.findById(creatorId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!creator.isApproved()) throw new RuntimeException("Tài khoản chưa được kích hoạt");
            if (!creator.isCanBo()) throw new RuntimeException("Chỉ cán bộ được tạo phiếu xin lĩnh");

            validateCreateRequest(request);

            IssueReqHeader header = new IssueReqHeader();
            header.setCreatedBy(creator);
            header.setRequestedAt(LocalDateTime.now());
            header.setStatus(requireDocStatus(DOC_PENDING));
            header.setNote(request.getNote());

            if (creator.getDepartment() != null) {
                header.setDepartment(creator.getDepartment());
            } else {
                throw new RuntimeException("Cán bộ phải thuộc một khoa/phòng");
            }

            if (request.getSubDepartmentId() != null) {
                SubDepartment subDepartment = subDepartmentRepository.findById(request.getSubDepartmentId())
                        .orElseThrow(() -> new RuntimeException("Sub-department không tồn tại"));

                if (!subDepartment.getDepartment().getId().equals(creator.getDepartment().getId())) {
                    throw new RuntimeException("Bộ môn không thuộc khoa/phòng của bạn");
                }
                header.setSubDepartment(subDepartment);
            }

            header = headerRepository.save(header);

            List<IssueReqDetail> details = createDetails(header, request.getDetails());
            header.setDetails(details);

            // ===== AUTO APPROVE nếu đủ tồn (đã giữ chỗ) =====
            boolean autoApproved = false;
            String autoFail = null;

            try {
                autoApproved = tryAutoApproveAndReserve(header.getId(), creator);
            } catch (Exception ex) {
                autoApproved = false;
                autoFail = ex.getMessage();
            }

            // Response
            IssueReqHeader fresh = headerRepository.findById(header.getId())
                    .orElseThrow(() -> new RuntimeException("Phiếu xin lĩnh không tồn tại"));

            IssueReqHeaderDTO headerDTO = convertToDTO(fresh);
            Map<String, Object> summary = createSummary(fresh);

            if (autoApproved) {
                notificationService.notifyApprovalResult(fresh, true, AUTO_APPROVAL_NOTE);

                return IssueReqDetailResponseDTO.success(
                        "Tạo phiếu xin lĩnh thành công. Hệ thống đã tự động phê duyệt do đủ tồn kho (đã giữ chỗ).",
                        headerDTO,
                        headerDTO.getDetails(),
                        summary
                );
            }

            // Không auto => gửi lãnh đạo
            notificationService.notifyLeadersForApproval(fresh);

            if (autoFail != null && !autoFail.trim().isEmpty()) {
                summary.put("autoApprovalFailReason", autoFail);
            }

            return IssueReqDetailResponseDTO.success(
                    "Tạo phiếu xin lĩnh thành công và đã gửi cho lãnh đạo phê duyệt",
                    headerDTO,
                    headerDTO.getDetails(),
                    summary
            );

        } catch (Exception e) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            return IssueReqDetailResponseDTO.error("Lỗi khi tạo phiếu xin lĩnh: " + e.getMessage());
        }
    }

    public IssueReqListResponseDTO getRequestsForCanBo(Long canBoId) {
        try {
            User canBo = userRepository.findById(canBoId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!canBo.isApproved()) throw new RuntimeException("Tài khoản chưa được kích hoạt");

            List<IssueReqHeader> requests =
                    headerRepository.findByCreatedByIdOrderByRequestedAtDesc(canBoId);

            List<IssueReqHeaderDTO> requestDTOs = requests.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            long totalCount = requests.size();
            long pendingCount = requests.stream().filter(r -> isDocStatus(r, DOC_PENDING)).count();
            long approvedCount = requests.stream().filter(r -> isDocStatus(r, DOC_APPROVED)).count();
            long rejectedCount = requests.stream().filter(r -> isDocStatus(r, DOC_REJECTED)).count();

            return IssueReqListResponseDTO.success(
                    requestDTOs.isEmpty() ? "Chưa có phiếu xin lĩnh nào" : "Lấy danh sách phiếu thành công",
                    requestDTOs,
                    totalCount,
                    (int) pendingCount,
                    (int) approvedCount,
                    (int) rejectedCount
            );

        } catch (Exception e) {
            return IssueReqListResponseDTO.success(
                    "Chưa có phiếu xin lĩnh nào",
                    new ArrayList<>(),
                    0L, 0, 0, 0
            );
        }
    }

    public IssueReqDetailResponseDTO loadPreviousRequestTemplate(Long canBoId, Long subDepartmentId) {
        try {
            User canBo = userRepository.findById(canBoId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!canBo.isApproved()) throw new RuntimeException("Tài khoản chưa được kích hoạt");
            if (!canBo.isCanBo()) throw new RuntimeException("Chỉ cán bộ dùng chức năng này");
            if (canBo.getDepartment() == null) throw new RuntimeException("Cán bộ phải thuộc một khoa/phòng");

            IssueReqHeader prev;
            Long deptId = canBo.getDepartment().getId();

            if (subDepartmentId != null) {
                prev = headerRepository.findTopByDepartmentIdAndSubDepartmentIdOrderByRequestedAtDesc(deptId, subDepartmentId);
            } else {
                prev = headerRepository.findTopByDepartmentIdOrderByRequestedAtDesc(deptId);
            }

            if (prev == null) {
                return IssueReqDetailResponseDTO.error("Chưa có phiếu xin lĩnh kỳ trước để load");
            }

            IssueReqHeaderDTO headerDTO = convertToDTO(prev);
            Map<String, Object> summary = createSummary(prev);

            return IssueReqDetailResponseDTO.success("Load danh sách kỳ trước thành công", headerDTO, headerDTO.getDetails(), summary);

        } catch (Exception e) {
            return IssueReqDetailResponseDTO.error("Không thể load kỳ trước: " + e.getMessage());
        }
    }

    // ==================== VALIDATIONS & BASIC HELPERS ====================

    private User getLeaderUser(Long userId, String errorMessage) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (!user.isLanhDao()) throw new RuntimeException(errorMessage);
        if (!user.isApproved()) throw new RuntimeException("Tài khoản chưa được kích hoạt");

        return user;
    }

    private boolean hasPermissionToView(IssueReqHeader header, User user) {
        if (header.getCreatedBy() != null && header.getCreatedBy().getId().equals(user.getId())) return true;
        if (user.isThuKho()) return true;
        if (user.isLanhDao()) return true;
        if (user.isBanGiamHieu()) return true;
        return false;
    }

    private void validateCreateRequest(CreateIssueReqDTO request) {
        if (request == null) throw new RuntimeException("Request không hợp lệ");
        if (request.getDetails() == null || request.getDetails().isEmpty()) {
            throw new RuntimeException("Phiếu xin lĩnh phải có ít nhất 1 vật tư");
        }

        for (CreateIssueReqDetailDTO detail : request.getDetails()) {
            if (detail.getQtyRequested() == null || detail.getQtyRequested().compareTo(BigDecimal.ZERO) <= 0) {
                throw new RuntimeException("Số lượng vật tư phải lớn hơn 0");
            }

            boolean hasMaterialId = detail.getMaterialId() != null;
            boolean hasNewMaterialInfo = detail.getMaterialName() != null
                    && !detail.getMaterialName().trim().isEmpty()
                    && detail.getUnitId() != null;

            if (!hasMaterialId && !hasNewMaterialInfo) {
                throw new RuntimeException("Vật tư phải có mã (đã có trong danh mục) hoặc tên + đơn vị tính (vật tư mới)");
            }

            if (!hasMaterialId) {
                if (detail.getCategory() == null || detail.getCategory().trim().isEmpty()) {
                    throw new RuntimeException("Vật tư mới phải có loại (A, B, C, D)");
                }
                String category = detail.getCategory().trim().toUpperCase();
                if (!category.matches("[ABCD]")) {
                    throw new RuntimeException("Loại vật tư phải là A, B, C hoặc D");
                }
            }

            if (detail.getMaterialId() != null) {
                materialRepository.findById(detail.getMaterialId())
                        .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại với ID: " + detail.getMaterialId()));
            }

            if (detail.getUnitId() != null && detail.getMaterialId() == null) {
                unitRepository.findById(detail.getUnitId())
                        .orElseThrow(() -> new RuntimeException("Đơn vị tính không tồn tại với ID: " + detail.getUnitId()));
            }
        }
    }

    private List<IssueReqDetail> createDetails(IssueReqHeader header, List<CreateIssueReqDetailDTO> detailDTOs) {
        List<IssueReqDetail> details = new ArrayList<>();

        for (CreateIssueReqDetailDTO detailDTO : detailDTOs) {
            IssueReqDetail detail = new IssueReqDetail();
            detail.setHeader(header);
            detail.setQtyRequested(detailDTO.getQtyRequested());
            detail.setProposedCode(detailDTO.getProposedCode());
            detail.setProposedManufacturer(detailDTO.getProposedManufacturer());
            detail.setMaterialName(detailDTO.getMaterialName());
            detail.setSpec(detailDTO.getSpec());

            if (detailDTO.getCategory() != null && !detailDTO.getCategory().trim().isEmpty()) {
                detail.setMaterialCategory(detailDTO.getCategory().trim().toUpperCase());
            }

            if (detailDTO.getUnitId() != null) {
                Unit unit = unitRepository.findById(detailDTO.getUnitId())
                        .orElseThrow(() -> new RuntimeException("Đơn vị tính không tồn tại"));
                detail.setUnit(unit);
            }

            if (detailDTO.getMaterialId() != null) {
                Material material = materialRepository.findById(detailDTO.getMaterialId())
                        .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại"));
                detail.setMaterial(material);
            } else {
                // Vật tư mới: nếu proposedCode đã tồn tại thì map về vật tư cũ
                String proposedCode = safeTrim(detailDTO.getProposedCode());
                if (!proposedCode.isEmpty()) {
                    Material existing = materialRepository.findByCode(proposedCode);
                    detail.setMaterial(existing); // null nếu chưa có
                } else {
                    detail.setMaterial(null);
                }
            }

            details.add(detail);
        }

        return detailRepository.saveAll(details);
    }

    private boolean hasAnyUnmappedMaterial(IssueReqHeader header) {
        if (header == null || header.getDetails() == null) return false;
        return header.getDetails().stream().anyMatch(d -> d.getMaterial() == null);
    }

    // ==================== SUMMARY / DTO ====================

    private Map<String, Object> createSummary(IssueReqHeader header) {
        Map<String, Object> summary = new HashMap<>();

        long totalMaterials = header.getDetails().size();
        BigDecimal totalQty = header.getDetails().stream()
                .map(IssueReqDetail::getQtyRequested)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Long> categoryCount = header.getDetails().stream()
                .collect(Collectors.groupingBy(
                        d -> d.getMaterialCategory() == null ? "?" : d.getMaterialCategory().toString(),
                        Collectors.counting()
                ));

        long newMaterials = header.getDetails().stream()
                .filter(d -> d.getMaterial() == null)
                .count();

        summary.put("totalMaterials", totalMaterials);
        summary.put("totalQuantity", totalQty);
        summary.put("categoryBreakdown", categoryCount);
        summary.put("newMaterials", newMaterials);
        summary.put("existingMaterials", totalMaterials - newMaterials);

        return summary;
    }

    private IssueReqHeaderDTO convertToDTO(IssueReqHeader header) {
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

        String docCode = getDocCode(header);
        dto.setStatus(docCodeToInt(docCode));
        dto.setStatusName(docCodeToName(docCode));
        dto.setStatusBadge(docCodeToBadge(docCode));

        if (header.getApprovalBy() != null) {
            dto.setApprovalById(header.getApprovalBy().getId());
            dto.setApprovalByName(header.getApprovalBy().getFullName());
        }

        dto.setApprovalAt(header.getApprovalAt());
        dto.setApprovalNote(header.getApprovalNote());
        dto.setNote(header.getNote());

        List<IssueReqDetailDTO> detailDTOs = header.getDetails().stream()
                .map(this::convertDetailToDTO)
                .collect(Collectors.toList());
        dto.setDetails(detailDTOs);

        return dto;
    }

    private IssueReqDetailDTO convertDetailToDTO(IssueReqDetail detail) {
        IssueReqDetailDTO dto = new IssueReqDetailDTO();
        dto.setId(detail.getId());
        dto.setQtyRequested(detail.getQtyRequested());
        dto.setProposedCode(detail.getProposedCode());
        dto.setProposedManufacturer(detail.getProposedManufacturer());
        dto.setCategory(toCategoryChar(detail.getMaterialCategory()));

        boolean isNewMaterial = (detail.getMaterial() == null);
        dto.setIsNewMaterial(isNewMaterial);

        if (detail.getMaterial() != null) {
            dto.setMaterialId(detail.getMaterial().getId());
            dto.setMaterialName(detail.getDisplayMaterialName());
            dto.setSpec(detail.getDisplaySpec());
            if (detail.getMaterial().getUnit() != null) {
                dto.setUnitId(detail.getMaterial().getUnit().getId());
                dto.setUnitName(detail.getMaterial().getUnit().getName());
            }
        } else {
            dto.setMaterialName(detail.getMaterialName());
            dto.setSpec(detail.getSpec());
            if (detail.getUnit() != null) {
                dto.setUnitId(detail.getUnit().getId());
                dto.setUnitName(detail.getUnit().getName());
            }
        }

        return dto;
    }

    private Character toCategoryChar(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return Character.toUpperCase(t.charAt(0));
    }

    // ==================== DocStatus helpers ====================

    private DocStatus requireDocStatus(String code) {
        return docStatusRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Thiếu doc_status code=" + code));
    }

    private boolean isDocStatus(IssueReqHeader h, String code) {
        return code.equalsIgnoreCase(getDocCode(h));
    }

    private String getDocCode(IssueReqHeader h) {
        if (h == null || h.getStatus() == null || h.getStatus().getCode() == null) return DOC_PENDING;
        return h.getStatus().getCode();
    }

    private Integer docCodeToInt(String code) {
        if (code == null) return 0;
        String c = code.trim().toUpperCase();
        if (DOC_APPROVED.equals(c)) return 1;
        if (DOC_REJECTED.equals(c)) return 2;
        return 0;
    }

    private String docCodeToName(String code) {
        if (code == null) return "Chờ phê duyệt";
        String c = code.trim().toUpperCase();
        if (DOC_APPROVED.equals(c)) return "Đã phê duyệt";
        if (DOC_REJECTED.equals(c)) return "Bị từ chối";
        return "Chờ phê duyệt";
    }

    private String docCodeToBadge(String code) {
        if (code == null) return "pending";
        String c = code.trim().toUpperCase();
        if (DOC_APPROVED.equals(c)) return "approved";
        if (DOC_REJECTED.equals(c)) return "rejected";
        return "pending";
    }

    private static String safeTrim(String s) {
        return s == null ? "" : s.trim();
    }

    private static BigDecimal nvl(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    // ==================== RESERVATION (GIỮ CHỖ) ====================

    private ReservationStatus requireReservationStatus(String code) {
        return reservationStatusRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Thiếu reservation_status code=" + code));
    }

    /**
     * Auto-approve chỉ khi: phiếu đang PENDING + tất cả dòng đã map material_id + reserve đủ.
     */
    private boolean tryAutoApproveAndReserve(Long issueReqId, User creator) {
        if (issueReqId == null) return false;

        IssueReqHeader header = headerRepository.lockByIdForUpdate(issueReqId);
        if (header == null) return false;

        if (!isDocStatus(header, DOC_PENDING)) return false;

        // Auto chỉ cho phiếu đã map đầy đủ (tránh approve "ảo")
        if (hasAnyUnmappedMaterial(header)) return false;

        // Reserve đủ tồn (FEFO, trừ giữ chỗ phiếu khác)
        reserveStockForWholeRequestOrThrow(header, creator, "AUTO_APPROVE");

        header.setStatus(requireDocStatus(DOC_APPROVED));
        header.setApprovalBy(null);
        header.setApprovalAt(LocalDateTime.now());
        header.setApprovalNote(AUTO_APPROVAL_NOTE);

        headerRepository.save(header);
        return true;
    }

    /**
     * Reserve đủ cho toàn phiếu theo FEFO.
     * - Trước khi reserve: huỷ reservation ACTIVE cũ của chính phiếu (nếu có) để tránh kẹt.
     * - Trong khi reserve: lock inventory_card latest theo từng lot (FOR UPDATE) để tránh oversubscribe.
     */
    private void reserveStockForWholeRequestOrThrow(IssueReqHeader header, User actor, String reason) {
        if (header == null || header.getId() == null) throw new RuntimeException("Phiếu không hợp lệ");

        // Huỷ ACTIVE cũ (nếu approve lại / retry)
        cancelActiveReservationsWithReason(header, actor, "RESET_BEFORE_RESERVE: " + safeTrim(reason));

        Map<Long, BigDecimal> needByMaterial = buildNeedByMaterial(header);

        if (needByMaterial.isEmpty()) {
            // Không có material để reserve (trường hợp đặc biệt)
            return;
        }

        // Cache reserved ACTIVE theo (material|lot) để giảm query và cập nhật nội bộ trong transaction
        Map<String, BigDecimal> reservedCache = new HashMap<>();

        // Build list reservations trước; chỉ save khi OK toàn bộ
        List<IssueReservation> toSave = new ArrayList<>();

        // Duyệt material theo thứ tự tăng để giảm nguy cơ deadlock
        List<Long> materialIds = new ArrayList<>(needByMaterial.keySet());
        materialIds.sort(Long::compareTo);

        // Map material object từ details để tránh findById lặp
        Map<Long, Material> materialMap = buildMaterialMapFromDetails(header);

        for (Long materialId : materialIds) {
            BigDecimal remaining = nvl(needByMaterial.get(materialId));
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) continue;

            Material material = materialMap.get(materialId);
            if (material == null) {
                throw new RuntimeException("Không tìm thấy materialId=" + materialId + " trong details");
            }

            List<InventoryCard> lots = inventoryCardRepository.findAvailableLotsLatestByMaterial(materialId);

            for (InventoryCard ic : lots) {
                if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;

                String lot = safeTrim(ic.getLotNumber());
                if (lot.isEmpty()) continue;

                // Lock lot latest để serialize reserve theo lot
                InventoryCard latest = inventoryCardRepository.lockLatestByMaterialAndLot(materialId, lot)
                        .orElse(null);
                if (latest == null) continue;

                BigDecimal closing = nvl(latest.getClosingStock());
                if (closing.compareTo(BigDecimal.ZERO) <= 0) continue;

                BigDecimal reserved = getActiveReservedSum(materialId, lot, reservedCache);
                BigDecimal net = closing.subtract(reserved);
                if (net.compareTo(BigDecimal.ZERO) <= 0) continue;

                BigDecimal take = net.min(remaining);
                if (take.compareTo(BigDecimal.ZERO) <= 0) continue;

                IssueReservation r = new IssueReservation();
                r.setIssueReqHeader(header);
                r.setIssueReqDetail(null); // gom theo material; nếu cần trace theo dòng có thể nâng cấp sau
                r.setMaterial(material);
                r.setLotNumber(lot);
                r.setQtyReserved(take);
                r.setStatus(requireReservationStatus(RES_ACTIVE));
                r.setCreatedBy(actor);
                r.setNote(buildReserveNote(reason, actor));

                toSave.add(r);

                // update cache để những dòng sau trừ đúng phần vừa reserve trong transaction này
                String key = materialId + "|" + lot;
                reservedCache.put(key, reserved.add(take));

                remaining = remaining.subtract(take);
            }

            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal availableNet = estimateNetAvailable(materialId, reservedCache);
                throw new RuntimeException("Không đủ tồn để phê duyệt (đã trừ giữ chỗ): "
                        + material.getCode() + " - " + material.getName()
                        + " (cần " + needByMaterial.get(materialId) + ", còn " + availableNet + ")");
            }
        }

        issueReservationRepository.saveAll(toSave);
    }

    private Map<Long, BigDecimal> buildNeedByMaterial(IssueReqHeader header) {
        Map<Long, BigDecimal> needByMaterial = new LinkedHashMap<>();
        if (header.getDetails() == null) return needByMaterial;

        for (IssueReqDetail d : header.getDetails()) {
            if (d.getMaterial() == null) continue;
            BigDecimal qty = nvl(d.getQtyRequested());
            if (qty.compareTo(BigDecimal.ZERO) <= 0) continue;

            Long mid = d.getMaterial().getId();
            needByMaterial.merge(mid, qty, BigDecimal::add);
        }
        return needByMaterial;
    }

    private Map<Long, Material> buildMaterialMapFromDetails(IssueReqHeader header) {
        Map<Long, Material> map = new HashMap<>();
        if (header.getDetails() == null) return map;

        for (IssueReqDetail d : header.getDetails()) {
            if (d.getMaterial() == null) continue;
            map.putIfAbsent(d.getMaterial().getId(), d.getMaterial());
        }
        return map;
    }

    private BigDecimal getActiveReservedSum(Long materialId, String lotNumber, Map<String, BigDecimal> cache) {
        String lot = safeTrim(lotNumber);
        String key = materialId + "|" + lot;
        return cache.computeIfAbsent(key, k -> {
            BigDecimal v = issueReservationRepository.sumActiveReservedByMaterialAndLot(materialId, lot);
            return v == null ? BigDecimal.ZERO : v;
        });
    }

    private BigDecimal estimateNetAvailable(Long materialId, Map<String, BigDecimal> reservedCache) {
        List<InventoryCard> lots = inventoryCardRepository.findAvailableLotsLatestByMaterial(materialId);
        BigDecimal sum = BigDecimal.ZERO;

        for (InventoryCard ic : lots) {
            String lot = safeTrim(ic.getLotNumber());
            BigDecimal closing = nvl(ic.getClosingStock());
            BigDecimal reserved = getActiveReservedSum(materialId, lot, reservedCache);
            BigDecimal net = closing.subtract(reserved);
            if (net.compareTo(BigDecimal.ZERO) > 0) sum = sum.add(net);
        }
        return sum;
    }

    private String buildReserveNote(String reason, User actor) {
        String n = safeTrim(reason);
        String who = (actor != null) ? safeTrim(actor.getFullName()) : "";
        if (!who.isEmpty()) {
            if (!n.isEmpty()) n = n + " | ";
            n = n + "by " + who;
        }
        return n;
    }

    private void cancelActiveReservationsWithReason(IssueReqHeader header, User by, String reason) {
        if (header == null || header.getId() == null) return;

        List<IssueReservation> actives =
                issueReservationRepository.findByIssueReqHeader_IdAndStatus_Code(header.getId(), RES_ACTIVE);

        if (actives == null || actives.isEmpty()) return;

        ReservationStatus cancelled = requireReservationStatus(RES_CANCELLED);

        String note = safeTrim(reason);
        if (by != null && by.getFullName() != null) {
            if (!note.isEmpty()) note = note + " | ";
            note = note + "by " + by.getFullName();
        }

        for (IssueReservation r : actives) {
            r.setStatus(cancelled);
            r.setNote(note);
        }

        issueReservationRepository.saveAll(actives);
    }

    private void cancelActiveReservationsRejected(IssueReqHeader header, User by, String note) {
        String reason = "Cancelled do phiếu bị từ chối"
                + (by != null ? (" bởi " + by.getFullName()) : "")
                + (note != null && !note.trim().isEmpty() ? (". Note: " + note.trim()) : "");
        cancelActiveReservationsWithReason(header, by, reason);
    }
}
