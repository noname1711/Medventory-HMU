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
            System.out.println("Error in getPendingRequestsForLeader: " + e.getMessage());
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
            System.out.println("Error in getProcessedRequestsForLeader: " + e.getMessage());
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
            System.out.println("Error in getRequestDetailWithSummary: " + e.getMessage());
            return IssueReqDetailResponseDTO.error("Không thể tải chi tiết phiếu");
        }
    }

    // ==================== THAO TÁC PHÊ DUYỆT ====================

    @Transactional
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
        if (header.getCreatedBy().getId().equals(user.getId())) {
            return true;
        }
        if (user.isLanhDao()) {
            return true;
        }
        if (user.isBanGiamHieu()) {
            return true;
        }
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

            if (detailDTO.getMaterialId() != null) {
                // Vật tư có trong danh mục
                Material material = materialRepository.findById(detailDTO.getMaterialId())
                        .orElseThrow(() -> new RuntimeException("Vật tư không tồn tại"));
                detail.setMaterial(material);
            } else {
                // VẬT TƯ MỚI - TẠO MATERIAL MỚI VỚI CATEGORY TỪ FRONTEND
                Material newMaterial = new Material();
                newMaterial.setName(detailDTO.getMaterialName());
                newMaterial.setSpec(detailDTO.getSpec());
                newMaterial.setCode(detailDTO.getProposedCode());
                newMaterial.setManufacturer(detailDTO.getProposedManufacturer());

                // SET CATEGORY TỪ FRONTEND
                if (detailDTO.getCategory() != null && !detailDTO.getCategory().isEmpty()) {
                    newMaterial.setCategory(detailDTO.getCategory().charAt(0));
                } else {
                    newMaterial.setCategory('D'); // Mặc định
                }

                if (detailDTO.getUnitId() != null) {
                    Unit unit = unitRepository.findById(detailDTO.getUnitId())
                            .orElseThrow(() -> new RuntimeException("Đơn vị tính không tồn tại"));
                    newMaterial.setUnit(unit);
                }

                // Lưu material mới
                newMaterial = materialRepository.save(newMaterial);
                detail.setMaterial(newMaterial);
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

        // Phân loại theo category - VẬT TƯ MỚI ĐÃ CÓ MATERIAL NÊN LẤY ĐÚNG CATEGORY
        Map<String, Long> categoryCount = header.getDetails().stream()
                .collect(Collectors.groupingBy(
                        detail -> detail.getMaterialCategory().toString(),
                        Collectors.counting()
                ));

        long newMaterials = header.getDetails().stream()
                .filter(detail -> {
                    // Vật tư mới là những vật tư được tạo trong phiếu này
                    Material material = detail.getMaterial();
                    return material != null && material.getCode().equals(detail.getProposedCode());
                })
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
        dto.setCategory(detail.getMaterialCategory()); // LẤY CATEGORY TỪ MATERIAL
        dto.setIsNewMaterial(detail.getMaterial() != null &&
                detail.getMaterial().getCode().equals(detail.getProposedCode()));

        if (detail.getMaterial() != null) {
            dto.setMaterialId(detail.getMaterial().getId());
            dto.setMaterialName(detail.getDisplayMaterialName());
            dto.setSpec(detail.getDisplaySpec());
            if (detail.getMaterial().getUnit() != null) {
                dto.setUnitId(detail.getMaterial().getUnit().getId());
                dto.setUnitName(detail.getMaterial().getUnit().getName());
            }
        } else {
            dto.setMaterialName(detail.getDisplayMaterialName());
            dto.setSpec(detail.getDisplaySpec());
            if (detail.getUnit() != null) {
                dto.setUnitId(detail.getUnit().getId());
                dto.setUnitName(detail.getUnit().getName());
            }
        }

        return dto;
    }
}