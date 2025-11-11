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

            // SỬA: Lấy tất cả phiếu pending từ mọi department
            List<IssueReqHeader> pendingRequests = headerRepository.findByStatusOrderByRequestedAtDesc(0);
            List<IssueReqHeaderDTO> requestDTOs = pendingRequests.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            // SỬA: Count tất cả phiếu từ mọi department
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
            // KHÔNG throw exception, return response với empty array
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

            // SỬA: Lấy tất cả phiếu processed từ mọi department (status 1 hoặc 2)
            List<IssueReqHeader> processedRequests = headerRepository.findByStatusInOrderByRequestedAtDesc(List.of(1, 2));
            List<IssueReqHeaderDTO> requestDTOs = processedRequests.stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            // SỬA: Count tất cả phiếu từ mọi department
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

            // SỬA: Bỏ check department - lãnh đạo có thể phê duyệt phiếu từ mọi department
            // if (!header.getDepartment().getId().equals(approver.getDepartment().getId())) {
            //     throw new RuntimeException("Bạn không có quyền phê duyệt phiếu của department này");
            // }

            // Cập nhật thông tin phê duyệt
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
                    // Giữ status = 0, chỉ gửi thông báo yêu cầu điều chỉnh
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

    // ==================== HELPER METHODS ====================

    private User getUserWithRoleCheck(Long userId, Integer requiredRole, String errorMessage) {
        try {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!user.getRoleCheck().equals(requiredRole)) {
                throw new RuntimeException(errorMessage);
            }

            if (!user.isApproved()) {
                throw new RuntimeException("Tài khoản chưa được kích hoạt");
            }

            return user;
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    private boolean hasPermissionToView(IssueReqHeader header, User user) {
        // Người tạo phiếu được xem
        if (header.getCreatedBy().getId().equals(user.getId())) {
            return true;
        }

        // SỬA: Lãnh đạo được xem tất cả phiếu từ mọi department
        if (user.isLanhDao()) {
            return true;
        }

        // Ban giám hiệu được xem tất cả
        if (user.isBanGiamHieu()) {
            return true;
        }

        return false;
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
                        detail -> {
                            Character category = detail.getMaterialCategory();
                            return category != null ? category.toString() : "D";
                        },
                        Collectors.counting()
                ));

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

        // Created by info
        if (header.getCreatedBy() != null) {
            dto.setCreatedById(header.getCreatedBy().getId());
            dto.setCreatedByName(header.getCreatedBy().getFullName());
            dto.setCreatedByEmail(header.getCreatedBy().getEmail());
        }

        // Department info
        if (header.getSubDepartment() != null) {
            dto.setSubDepartmentId(header.getSubDepartment().getId());
            dto.setSubDepartmentName(header.getSubDepartment().getName());
        }

        if (header.getDepartment() != null) {
            dto.setDepartmentId(header.getDepartment().getId());
            dto.setDepartmentName(header.getDepartment().getName());
        }

        // Approval info
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

        // Convert details
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
        dto.setIsNewMaterial(detail.getMaterial() == null);

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