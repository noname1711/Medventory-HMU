package com.backend.service;

import com.backend.dto.*;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class IssueReqService {

    private final IssueReqHeaderRepository headerRepository;
    private final IssueReqDetailRepository detailRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final SubDepartmentRepository subDepartmentRepository;
    private final MaterialRepository materialRepository;
    private final UnitRepository unitRepository;
    private final NotificationService notificationService;

    // ==================== DANH SÁCH PHIẾU CHO LÃNH ĐẠO ====================

    public IssueReqListResponseDTO getPendingRequestsForLeader(Long leaderId) {
        try {
            User leader = getUserWithRoleCheck(leaderId, 1, "Chỉ lãnh đạo được xem phiếu chờ phê duyệt");

            List<IssueReqHeader> pendingRequests = headerRepository.findByStatusOrderByRequestedAtDesc(0);
            List<IssueReqHeaderDTO> requestDTOs = pendingRequests.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            long totalCount = headerRepository.countByStatus(0);
            long approvedCount = headerRepository.countByStatus(1);
            long rejectedCount = headerRepository.countByStatus(2);

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
            User leader = getUserWithRoleCheck(leaderId, 1, "Chỉ lãnh đạo được xem lịch sử phê duyệt");

            List<IssueReqHeader> processedRequests = headerRepository.findByStatusInOrderByRequestedAtDesc(List.of(1, 2));
            List<IssueReqHeaderDTO> requestDTOs = processedRequests.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            long totalCount = requestDTOs.size();
            long pendingCount = headerRepository.countByStatus(0);

            return IssueReqListResponseDTO.success(
                    requestDTOs.isEmpty() ? "Chưa có lịch sử phê duyệt" : "Lấy lịch sử phiếu thành công",
                    requestDTOs,
                    totalCount,
                    (int) pendingCount,
                    (int) requestDTOs.stream().filter(r -> r.getStatus() == 1).count(),
                    (int) requestDTOs.stream().filter(r -> r.getStatus() == 2).count()
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

            User approver = getUserWithRoleCheck(request.getApproverId(), 1, "Chỉ lãnh đạo được phê duyệt phiếu");

            if (!header.isPending()) {
                throw new RuntimeException("Phiếu này đã được xử lý");
            }

            header.setApprovalBy(approver);
            header.setApprovalAt(LocalDateTime.now());
            header.setApprovalNote(request.getNote());

            switch (request.getAction()) {
                case ApprovalActionDTO.ACTION_APPROVE:
                    header.setStatus(1);

                    // TẠO MATERIAL MỚI CHO CÁC VẬT TƯ MỚI KHI PHÊ DUYỆT
                    createNewMaterialsForApprovedRequest(header);

                    notificationService.notifyApprovalResult(header, true, request.getNote());
                    break;

                case ApprovalActionDTO.ACTION_REJECT:
                    header.setStatus(2);
                    notificationService.notifyApprovalResult(header, false, request.getNote());
                    break;

                case ApprovalActionDTO.ACTION_REQUEST_ADJUSTMENT:
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

    // Tạo material cho các vật tư mới khi được phê duyệt
    private void createNewMaterialsForApprovedRequest(IssueReqHeader header) {
        for (IssueReqDetail detail : header.getDetails()) {
            // Chỉ xử lý các vật tư mới (chưa có material)
            if (detail.getMaterial() == null && detail.getProposedCode() != null) {

                // Kiểm tra lại xem code đã tồn tại chưa (phòng trường hợp trùng)
                Material existingMaterial = materialRepository.findByCode(detail.getProposedCode());
                if (existingMaterial != null) {
                    // Nếu đã tồn tại, map đến vật tư có sẵn
                    detail.setMaterial(existingMaterial);
                } else {
                    // Tạo material mới
                    Material newMaterial = new Material();
                    newMaterial.setName(detail.getMaterialName());
                    newMaterial.setSpec(detail.getSpec());
                    newMaterial.setCode(detail.getProposedCode());
                    newMaterial.setManufacturer(detail.getProposedManufacturer());

                    // Sử dụng category từ materialCategory (đã lưu khi tạo phiếu)
                    newMaterial.setCategory(detail.getMaterialCategory() != null ? detail.getMaterialCategory() : 'D');

                    if (detail.getUnit() != null) {
                        newMaterial.setUnit(detail.getUnit());
                    }

                    // Lưu material mới
                    newMaterial = materialRepository.save(newMaterial);
                    detail.setMaterial(newMaterial);
                }
            }
        }

        // Lưu các detail đã được cập nhật
        detailRepository.saveAll(header.getDetails());
    }

    // ==================== TẠO PHIẾU XIN LĨNH CHO CÁN BỘ ====================

    public IssueReqDetailResponseDTO createIssueRequest(CreateIssueReqDTO request, Long creatorId) {
        try {
            User creator = userRepository.findById(creatorId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!creator.isApproved()) {
                throw new RuntimeException("Tài khoản chưa được kích hoạt");
            }

            if (!creator.isCanBo()) {
                throw new RuntimeException("Chỉ cán bộ được tạo phiếu xin lĩnh");
            }

            validateCreateRequest(request);

            // Tạo header
            IssueReqHeader header = new IssueReqHeader();
            header.setCreatedBy(creator);
            header.setRequestedAt(LocalDateTime.now());
            header.setStatus(0);
            header.setNote(request.getNote());

            if (creator.getDepartment() != null) {
                header.setDepartment(creator.getDepartment());
            } else {
                throw new RuntimeException("Cán bộ phải thuộc một khoa/phòng");
            }

            // Set sub-department
            if (request.getSubDepartmentId() != null) {
                SubDepartment subDepartment = subDepartmentRepository.findById(request.getSubDepartmentId())
                        .orElseThrow(() -> new RuntimeException("Sub-department không tồn tại"));

                if (!subDepartment.getDepartment().getId().equals(creator.getDepartment().getId())) {
                    throw new RuntimeException("Bộ môn không thuộc khoa/phòng của bạn");
                }

                header.setSubDepartment(subDepartment);
            }

            header = headerRepository.save(header);

            // Tạo details - VẬT TƯ MỚI SẼ ĐƯỢC TẠO MATERIAL MỚI
            List<IssueReqDetail> details = createDetails(header, request.getDetails());
            header.setDetails(details);
            // GỬI THÔNG BÁO CHO LÃNH ĐẠO
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

            if (!canBo.isApproved()) {
                throw new RuntimeException("Tài khoản chưa được kích hoạt");
            }

            List<IssueReqHeader> requests = headerRepository.findByCreatedByIdOrderByRequestedAtDesc(canBoId);
            List<IssueReqHeaderDTO> requestDTOs = requests.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            long totalCount = requests.size();
            long pendingCount = requests.stream().filter(r -> r.getStatus() == 0).count();
            long approvedCount = requests.stream().filter(r -> r.getStatus() == 1).count();
            long rejectedCount = requests.stream().filter(r -> r.getStatus() == 2).count();

            return IssueReqListResponseDTO.success(
                    requestDTOs.isEmpty() ? "Chưa có phiếu xin lĩnh nào" : "Lấy danh sách phiếu thành công",
                    requestDTOs,
                    totalCount,
                    (int) pendingCount,
                    (int) approvedCount,
                    (int) rejectedCount
            );

        } catch (Exception e) {
            System.out.println("Error in getRequestsForCanBo: " + e.getMessage());
            return IssueReqListResponseDTO.success(
                    "Chưa có phiếu xin lĩnh nào",
                    new ArrayList<>(),
                    0L, 0, 0, 0
            );
        }
    }

    // ==================== HELPER METHODS ====================

    private User getUserWithRoleCheck(Long userId, Integer requiredRole, String errorMessage) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (!user.getRoleCheck().equals(requiredRole)) {
            throw new RuntimeException(errorMessage);
        }

        if (!user.isApproved()) {
            throw new RuntimeException("Tài khoản chưa được kích hoạt");
        }

        return user;
    }

    private boolean hasPermissionToView(IssueReqHeader header, User user) {
        if (header.getCreatedBy().getId().equals(user.getId())) return true;
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
            boolean hasNewMaterialInfo = detail.getMaterialName() != null &&
                    !detail.getMaterialName().trim().isEmpty() &&
                    detail.getUnitId() != null;

            if (!hasMaterialId && !hasNewMaterialInfo) {
                throw new RuntimeException("Vật tư phải có mã (đã có trong danh mục) hoặc tên + đơn vị tính (vật tư mới)");
            }

            // VALIDATE CATEGORY CHO VẬT TƯ MỚI
            if (detail.getMaterialId() == null) {
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

            // LUÔN LUÔN LƯU CATEGORY TỪ FRONTEND VÀO MATERIAL_CATEGORY
            if (detailDTO.getCategory() != null && !detailDTO.getCategory().isEmpty()) {
                detail.setMaterialCategory(detailDTO.getCategory().charAt(0));
            }

            if (detailDTO.getUnitId() != null) {
                Unit unit = unitRepository.findById(detailDTO.getUnitId())
                        .orElseThrow(() -> new RuntimeException("Đơn vị tính không tồn tại"));
                detail.setUnit(unit);
            }

            if (detailDTO.getMaterialId() != null) {
                // Vật tư có sẵn
                Material material = materialRepository.findById(detailDTO.getMaterialId())
                        .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại"));
                detail.setMaterial(material);
            } else {
                // Vật tư mới - KIỂM TRA CODE ĐÃ TỒN TẠI CHƯA
                if (detailDTO.getProposedCode() != null && !detailDTO.getProposedCode().trim().isEmpty()) {
                    Material existingMaterial = materialRepository.findByCode(detailDTO.getProposedCode());

                    if (existingMaterial != null) {
                        // CODE ĐÃ TỒN TẠI -> Map đến vật tư có sẵn
                        detail.setMaterial(existingMaterial);
                    } else {
                        // CODE CHƯA TỒN TẠI -> Vật tư mới
                        detail.setMaterial(null); // Vật tư mới, chưa có trong danh mục
                    }
                } else {
                    // Không có proposed code -> Vật tư mới
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

        // Phân loại theo category
        Map<String, Long> categoryCount = header.getDetails().stream()
                .collect(Collectors.groupingBy(
                        detail -> detail.getMaterialCategory().toString(),
                        Collectors.counting()
                ));

        // Đếm vật tư mới CHÍNH XÁC - vật tư mới là khi material == null
        long newMaterials = header.getDetails().stream()
                .filter(detail -> detail.getMaterial() == null)
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
        dto.setCategory(detail.getMaterialCategory());

        // Vật tư có sẵn nếu material != null (đã được map đến vật tư có sẵn)
        // Vật tư mới nếu material == null (chưa có trong danh mục)
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
}