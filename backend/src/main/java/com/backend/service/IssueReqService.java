package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private final IssueReqHeaderRepository headerRepository;
    private final IssueReqDetailRepository detailRepository;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final SubDepartmentRepository subDepartmentRepository;
    private final MaterialRepository materialRepository;
    private final UnitRepository unitRepository;

    private final DocStatusRepository docStatusRepository;
    private final NotificationService notificationService;

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
            IssueReqHeader header = headerRepository.findById(request.getIssueReqId())
                    .orElseThrow(() -> new RuntimeException("Phiếu xin lĩnh không tồn tại"));

            User approver = getLeaderUser(request.getApproverId(), "Chỉ lãnh đạo được phê duyệt phiếu");

            if (!isDocStatus(header, DOC_PENDING)) {
                throw new RuntimeException("Phiếu này đã được xử lý");
            }

            header.setApprovalBy(approver);
            header.setApprovalAt(LocalDateTime.now());
            header.setApprovalNote(request.getNote());

            switch (request.getAction()) {
                case ApprovalActionDTO.ACTION_APPROVE:
                    header.setStatus(requireDocStatus(DOC_APPROVED));
                    createNewMaterialsForApprovedRequest(header);
                    notificationService.notifyApprovalResult(header, true, request.getNote());
                    break;

                case ApprovalActionDTO.ACTION_REJECT:
                    header.setStatus(requireDocStatus(DOC_REJECTED));
                    notificationService.notifyApprovalResult(header, false, request.getNote());
                    break;

                case ApprovalActionDTO.ACTION_REQUEST_ADJUSTMENT:
                    // schema không có trạng thái riêng: giữ PENDING, chỉ gửi thông báo
                    notificationService.notifyAdjustmentRequest(header, request.getNote());
                    break;

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
            return IssueReqDetailResponseDTO.error("Lỗi khi xử lý phê duyệt: " + e.getMessage());
        }
    }

    private void createNewMaterialsForApprovedRequest(IssueReqHeader header) {
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

            notificationService.notifyLeadersForApproval(header);

            IssueReqHeaderDTO headerDTO = convertToDTO(header);
            Map<String, Object> summary = createSummary(header);

            return IssueReqDetailResponseDTO.success(
                    "Tạo phiếu xin lĩnh thành công và đã gửi cho lãnh đạo phê duyệt",
                    headerDTO,
                    headerDTO.getDetails(),
                    summary
            );

        } catch (Exception e) {
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

    // ==================== HELPER METHODS ====================

    private User getLeaderUser(Long userId, String errorMessage) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        // Giữ đúng logic cũ: leader mới được thao tác duyệt
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

    // -------------------- DocStatus helpers --------------------

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
}
