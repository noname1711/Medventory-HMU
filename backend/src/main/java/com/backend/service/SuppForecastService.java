package com.backend.service;

import com.backend.dto.SuppForecastApprovalDTO;
import com.backend.dto.SuppForecastDetailDTO;
import com.backend.dto.SuppForecastPreviousDTO;
import com.backend.dto.SuppForecastRequestDTO;
import com.backend.entity.*;
import com.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class SuppForecastService {

    private static final String DOC_PENDING  = "PENDING";
    private static final String DOC_APPROVED = "APPROVED";
    private static final String DOC_REJECTED = "REJECTED";

    private final SuppForecastHeaderRepository headerRepository;
    private final SuppForecastDetailRepository detailRepository;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final MaterialRepository materialRepository;
    private final DocStatusRepository docStatusRepository;

    private final RbacService rbacService;
    private final NotificationService notificationService;

    public ResponseEntity<?> getPendingForecasts(Long bghId) {
        try {
            User actor = rbacService.requireApprovedUser(bghId);
            rbacService.requirePermission(actor, RbacService.PERM_SUPP_FORECAST_APPROVE,
                    "Bạn không có quyền xem dự trù (cần SUPP_FORECAST.APPROVE)");

            List<SuppForecastHeader> forecasts =
                    headerRepository.findByStatus_CodeOrderByCreatedAtDesc(DOC_PENDING);

            List<Map<String, Object>> forecastDTOs = forecasts.stream()
                    .map(this::convertToForecastDTO)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(forecastDTOs);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi server: " + e.getMessage()));
        }
    }

    public ResponseEntity<?> getProcessedForecasts(Long bghId) {
        try {
            User actor = rbacService.requireApprovedUser(bghId);
            rbacService.requirePermission(actor, RbacService.PERM_SUPP_FORECAST_APPROVE,
                    "Bạn không có quyền xem lịch sử dự trù (cần SUPP_FORECAST.APPROVE)");

            List<SuppForecastHeader> forecasts =
                    headerRepository.findByStatus_CodeInOrderByCreatedAtDesc(List.of(DOC_APPROVED, DOC_REJECTED));

            List<Map<String, Object>> forecastDTOs = forecasts.stream()
                    .map(this::convertToForecastDTO)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(forecastDTOs);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi server: " + e.getMessage()));
        }
    }

    public ResponseEntity<?> approveForecast(SuppForecastApprovalDTO request) {
        try {
            SuppForecastHeader header = headerRepository.findById(request.getForecastId())
                    .orElseThrow(() -> new RuntimeException("Dự trù không tồn tại"));

            User approver = rbacService.requireApprovedUser(request.getApproverId());
            rbacService.requirePermission(approver, RbacService.PERM_SUPP_FORECAST_APPROVE,
                    "Bạn không có quyền phê duyệt dự trù (cần SUPP_FORECAST.APPROVE)");

            if (header.getStatus() == null || header.getStatus().getCode() == null
                    || !DOC_PENDING.equalsIgnoreCase(header.getStatus().getCode())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Dự trù đã được xử lý"));
            }

            header.setApprovalBy(approver);
            header.setApprovalAt(LocalDateTime.now());
            header.setApprovalNote(request.getNote());

            if (request.getAction() == 1) {
                header.setStatus(requireDocStatus(DOC_APPROVED));
            } else {
                header.setStatus(requireDocStatus(DOC_REJECTED));
            }


            boolean approved = (request.getAction() == 1);
            SuppForecastHeader saved = headerRepository.save(header);
            notificationService.notifySuppForecastResult(saved, approved, request.getNote());


            return ResponseEntity.ok(Map.of(
                    "message", approved ? "Đã phê duyệt dự trù" : "Đã từ chối dự trù",
                    "success", true
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi server: " + e.getMessage()));
        }
    }

    public ResponseEntity<?> getStats(Long bghId) {
        try {
            User actor = rbacService.requireApprovedUser(bghId);
            rbacService.requirePermission(actor, RbacService.PERM_SUPP_FORECAST_APPROVE,
                    "Bạn không có quyền xem thống kê dự trù (cần SUPP_FORECAST.APPROVE)");

            long pending = headerRepository.countByStatus_Code(DOC_PENDING);
            long approved = headerRepository.countByStatus_Code(DOC_APPROVED);
            long rejected = headerRepository.countByStatus_Code(DOC_REJECTED);

            return ResponseEntity.ok(Map.of(
                    "pending", pending,
                    "approved", approved,
                    "rejected", rejected,
                    "total", pending + approved + rejected
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi server: " + e.getMessage()));
        }
    }

    @Transactional
    public SuppForecastHeader createForecast(SuppForecastRequestDTO dto) {
        // Enforce permission theo user tạo (đang có createdByEmail trong DTO)
        String email = dto.getCreatedByEmail() != null ? dto.getCreatedByEmail().trim() : "";
        if (email.isEmpty()) {
            throw new SecurityException("Thiếu createdByEmail để kiểm tra quyền tạo dự trù");
        }

        User creator = userRepository.findByEmail(email)
                .orElseThrow(() -> new SecurityException("User không tồn tại với email=" + email));

        // giữ invariant login hiện tại: user thường phải approved
        if (!creator.isBanGiamHieu() && !creator.isApproved()) {
            throw new SecurityException("Tài khoản chưa được kích hoạt");
        }

        rbacService.requirePermission(creator, RbacService.PERM_SUPP_FORECAST_CREATE,
                "Bạn không có quyền tạo dự trù (cần SUPP_FORECAST.CREATE)");

        SuppForecastHeader header = new SuppForecastHeader();
        header.setAcademicYear(dto.getAcademicYear());

        Department dept = departmentRepository.findById(dto.getDepartmentId())
                .orElseThrow(() -> new RuntimeException("Department không tồn tại"));
        header.setDepartment(dept);

        header.setStatus(requireDocStatus(DOC_PENDING));
        header.setCreatedBy(creator);

        if (dto.getItems() != null) {
            for (SuppForecastDetailDTO itemDto : dto.getItems()) {
                SuppForecastDetail detail = new SuppForecastDetail();
                detail.setHeader(header);

                if (itemDto.getMaterialId() != null) {
                    materialRepository.findById(itemDto.getMaterialId()).ifPresent(detail::setMaterial);
                }

                if (itemDto.getCurrentStock() != null) detail.setCurrentStock(itemDto.getCurrentStock());
                if (itemDto.getPrevYearQty() != null) detail.setPrevYearQty(itemDto.getPrevYearQty());
                detail.setThisYearQty(itemDto.getThisYearQty());
                detail.setProposedCode(itemDto.getProposedCode());
                detail.setProposedManufacturer(itemDto.getProposedManufacturer());
                detail.setJustification(itemDto.getJustification());

                header.getDetails().add(detail);
            }
        }
        SuppForecastHeader saved = headerRepository.save(header);
        notificationService.notifyBghForSuppForecastApproval(saved);
        return saved;


    }

    public List<SuppForecastPreviousDTO> loadPreviousForecast(Long departmentId) {
        // NOTE: method này không có user context => không enforce permission được nếu không sửa controller.
        String previousYear = "2025-2026"; // TODO: tự động tính theo năm hiện tại

        List<SuppForecastHeader> headers;
        if (departmentId != null) {
            headers = headerRepository.findByAcademicYearAndDepartmentId(previousYear, departmentId);
        } else {
            headers = headerRepository.findByAcademicYear(previousYear);
        }

        List<SuppForecastPreviousDTO> result = new ArrayList<>();

        for (SuppForecastHeader h : headers) {
            for (SuppForecastDetail d : h.getDetails()) {
                SuppForecastPreviousDTO x = new SuppForecastPreviousDTO();

                x.setMaterialId(d.getMaterial() != null ? d.getMaterial().getId() : null);
                x.setMaterialName(d.getMaterial() != null ? d.getMaterial().getName() : null);
                x.setSpecification(d.getMaterial() != null ? d.getMaterial().getSpec() : null);
                x.setUnitId(d.getMaterial() != null && d.getMaterial().getUnit() != null ? d.getMaterial().getUnit().getId() : null);
                x.setMaterialCode(d.getMaterial() != null ? d.getMaterial().getCode() : null);
                x.setManufacturer(d.getMaterial() != null ? d.getMaterial().getManufacturer() : null);

                x.setCurrentStock(d.getCurrentStock());
                x.setPrevYearQty(d.getPrevYearQty());
                x.setThisYearQty(d.getThisYearQty());

                x.setJustification("Tự động tạo dự trù");
                x.setProposedCode(d.getProposedCode());
                x.setProposedManufacturer(d.getProposedManufacturer());
                x.setAcademicYear(h.getAcademicYear());

                result.add(x);
            }
        }

        return result;
    }

    private Map<String, Object> convertToForecastDTO(SuppForecastHeader forecast) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", forecast.getId());
        dto.put("academicYear", forecast.getAcademicYear());
        dto.put("status", forecast.getStatus() != null ? forecast.getStatus().getCode() : null);
        dto.put("createdAt", forecast.getCreatedAt());
        dto.put("approvalNote", forecast.getApprovalNote());
        dto.put("approvalAt", forecast.getApprovalAt());

        if (forecast.getDepartment() != null) {
            Map<String, Object> deptDTO = new HashMap<>();
            deptDTO.put("id", forecast.getDepartment().getId());
            deptDTO.put("name", forecast.getDepartment().getName());
            dto.put("department", deptDTO);
        }

        if (forecast.getCreatedBy() != null) {
            Map<String, Object> userDTO = new HashMap<>();
            userDTO.put("id", forecast.getCreatedBy().getId());
            userDTO.put("fullName", forecast.getCreatedBy().getFullName());
            userDTO.put("email", forecast.getCreatedBy().getEmail());
            dto.put("createdBy", userDTO);
        }

        if (forecast.getApprovalBy() != null) {
            Map<String, Object> approverDTO = new HashMap<>();
            approverDTO.put("id", forecast.getApprovalBy().getId());
            approverDTO.put("fullName", forecast.getApprovalBy().getFullName());
            dto.put("approvalBy", approverDTO);
        }

        if (forecast.getDetails() != null) {
            List<Map<String, Object>> detailDTOs = forecast.getDetails().stream()
                    .map(detail -> {
                        Map<String, Object> x = new HashMap<>();
                        x.put("id", detail.getId());
                        x.put("currentStock", detail.getCurrentStock());
                        x.put("prevYearQty", detail.getPrevYearQty());
                        x.put("thisYearQty", detail.getThisYearQty());
                        x.put("justification", detail.getJustification());
                        x.put("proposedCode", detail.getProposedCode());
                        x.put("proposedManufacturer", detail.getProposedManufacturer());

                        if (detail.getMaterial() != null) {
                            Map<String, Object> materialDTO = new HashMap<>();
                            materialDTO.put("id", detail.getMaterial().getId());
                            materialDTO.put("name", detail.getMaterial().getName());
                            materialDTO.put("spec", detail.getMaterial().getSpec());
                            materialDTO.put("code", detail.getMaterial().getCode());
                            materialDTO.put("category", detail.getMaterial().getCategory());
                            x.put("material", materialDTO);
                        }

                        return x;
                    })
                    .collect(Collectors.toList());
            dto.put("details", detailDTOs);
        }

        return dto;
    }

    private DocStatus requireDocStatus(String code) {
        return docStatusRepository.findByCode(code)
                .orElseThrow(() -> new RuntimeException("Thiếu doc_status code=" + code));
    }
}