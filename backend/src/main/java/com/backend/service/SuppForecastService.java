package com.backend.service;

import com.backend.dto.SuppForecastApprovalDTO;
import com.backend.dto.SuppForecastDetailDTO;
import com.backend.dto.SuppForecastPreviousDTO;
import com.backend.dto.SuppForecastRequestDTO;
import com.backend.entity.Material;
import com.backend.entity.SuppForecastDetail;
import com.backend.entity.SuppForecastHeader;
import com.backend.entity.User;
import com.backend.repository.MaterialRepository;
import com.backend.repository.SuppForecastDetailRepository;
import com.backend.repository.SuppForecastHeaderRepository;
import com.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class SuppForecastService {

    private final SuppForecastHeaderRepository headerRepository;
    private final UserRepository userRepository;

    public ResponseEntity<?> getPendingForecasts(Long bghId) {
        try {
            // Kiểm tra user tồn tại và là Ban Giám Hiệu
            User bgh = userRepository.findById(bghId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!bgh.isBanGiamHieu()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Chỉ Ban Giám Hiệu được xem dự trù"));
            }

            // Lấy dữ liệu từ repository
            List<SuppForecastHeader> forecasts = headerRepository.findByStatusOrderByCreatedAtDesc(0);

            // CHUYỂN ĐỔI sang DTO để tránh circular references
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
            User bgh = userRepository.findById(bghId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!bgh.isBanGiamHieu()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Chỉ Ban Giám Hiệu được xem lịch sử"));
            }

            List<SuppForecastHeader> forecasts = headerRepository.findByStatusInOrderByCreatedAtDesc(List.of(1, 2));

            // CHUYỂN ĐỔI sang DTO
            List<Map<String, Object>> forecastDTOs = forecasts.stream()
                    .map(this::convertToForecastDTO)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(forecastDTOs);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi server: " + e.getMessage()));
        }
    }

    // PHƯƠNG THỨC CHUYỂN ĐỔI ENTITY -> DTO
    private Map<String, Object> convertToForecastDTO(SuppForecastHeader forecast) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", forecast.getId());
        dto.put("academicYear", forecast.getAcademicYear());
        dto.put("status", forecast.getStatus());
        dto.put("createdAt", forecast.getCreatedAt());
        dto.put("approvalNote", forecast.getApprovalNote());
        dto.put("approvalAt", forecast.getApprovalAt());

        // Department info
        if (forecast.getDepartment() != null) {
            Map<String, Object> deptDTO = new HashMap<>();
            deptDTO.put("id", forecast.getDepartment().getId());
            deptDTO.put("name", forecast.getDepartment().getName());
            dto.put("department", deptDTO);
        }

        // Created by info
        if (forecast.getCreatedBy() != null) {
            Map<String, Object> userDTO = new HashMap<>();
            userDTO.put("id", forecast.getCreatedBy().getId());
            userDTO.put("fullName", forecast.getCreatedBy().getFullName());
            userDTO.put("email", forecast.getCreatedBy().getEmail());
            dto.put("createdBy", userDTO);
        }

        // Approval by info
        if (forecast.getApprovalBy() != null) {
            Map<String, Object> approverDTO = new HashMap<>();
            approverDTO.put("id", forecast.getApprovalBy().getId());
            approverDTO.put("fullName", forecast.getApprovalBy().getFullName());
            dto.put("approvalBy", approverDTO);
        }

        // Details info
        if (forecast.getDetails() != null) {
            List<Map<String, Object>> detailDTOs = forecast.getDetails().stream()
                    .map(detail -> {
                        Map<String, Object> detailDTO = new HashMap<>();
                        detailDTO.put("id", detail.getId());
                        detailDTO.put("currentStock", detail.getCurrentStock());
                        detailDTO.put("prevYearQty", detail.getPrevYearQty());
                        detailDTO.put("thisYearQty", detail.getThisYearQty());
                        detailDTO.put("justification", detail.getJustification());
                        detailDTO.put("proposedCode", detail.getProposedCode());
                        detailDTO.put("proposedManufacturer", detail.getProposedManufacturer());

                        // Material info
                        if (detail.getMaterial() != null) {
                            Map<String, Object> materialDTO = new HashMap<>();
                            materialDTO.put("id", detail.getMaterial().getId());
                            materialDTO.put("name", detail.getMaterial().getName());
                            materialDTO.put("spec", detail.getMaterial().getSpec());
                            materialDTO.put("code", detail.getMaterial().getCode());
                            materialDTO.put("category", detail.getMaterial().getCategory());
                            detailDTO.put("material", materialDTO);
                        }

                        return detailDTO;
                    })
                    .collect(Collectors.toList());
            dto.put("details", detailDTOs);
        }

        return dto;
    }

    public ResponseEntity<?> approveForecast(SuppForecastApprovalDTO request) {
        try {
            SuppForecastHeader header = headerRepository.findById(request.getForecastId())
                    .orElseThrow(() -> new RuntimeException("Dự trù không tồn tại"));

            User approver = userRepository.findById(request.getApproverId())
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!approver.isBanGiamHieu()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Chỉ Ban Giám Hiệu được phê duyệt"));
            }

            if (header.getStatus() != 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Dự trù đã được xử lý"));
            }

            // Cập nhật thông tin phê duyệt
            header.setApprovalBy(approver);
            header.setApprovalAt(LocalDateTime.now());
            header.setApprovalNote(request.getNote());
            header.setStatus(request.getAction()); // 1 = approve, 2 = reject

            headerRepository.save(header);

            Map<String, Object> response = new HashMap<>();
            response.put("message", request.getAction() == 1 ? "Đã phê duyệt dự trù" : "Đã từ chối dự trù");
            response.put("success", true);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi server: " + e.getMessage()));
        }
    }

    public ResponseEntity<?> getStats(Long bghId) {
        try {
            User bgh = userRepository.findById(bghId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));

            if (!bgh.isBanGiamHieu()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Chỉ Ban Giám Hiệu được xem thống kê"));
            }

            long pending = headerRepository.countByStatus(0);
            long approved = headerRepository.countByStatus(1);
            long rejected = headerRepository.countByStatus(2);

            Map<String, Object> stats = new HashMap<>();
            stats.put("pending", pending);
            stats.put("approved", approved);
            stats.put("rejected", rejected);
            stats.put("total", pending + approved + rejected);

            return ResponseEntity.ok(stats);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi server: " + e.getMessage()));
        }
    }

    @Autowired
    private MaterialRepository materialRepository;

    @Autowired
    private SuppForecastDetailRepository detailRepository;

    @Transactional
    public SuppForecastHeader createForecast(SuppForecastRequestDTO dto) {
        SuppForecastHeader header = new SuppForecastHeader();
        header.setAcademicYear(dto.getAcademicYear());
        header.setDepartmentId(dto.getDepartmentId());
        header.setStatus(0);

        if (dto.getCreatedByEmail() != null && !dto.getCreatedByEmail().isBlank()) {
            Optional<User> uOpt = userRepository.findByEmail(dto.getCreatedByEmail());
            uOpt.ifPresent(header::setCreatedBy);
        }

        if (dto.getItems() != null) {
            for (SuppForecastDetailDTO itemDto : dto.getItems()) {
                SuppForecastDetail detail = new SuppForecastDetail();
                detail.setHeader(header);

                if (itemDto.getMaterialId() != null) {
                    Optional<Material> mOpt = materialRepository.findById(itemDto.getMaterialId());
                    mOpt.ifPresent(detail::setMaterial);
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

        return headerRepository.save(header);
    }

    public List<SuppForecastPreviousDTO> loadPreviousForecast(Long departmentId) {

        String previousYear = "2025-2026"; // TODO: bạn có thể tự động tính theo năm hiện tại

        List<SuppForecastHeader> headers;

        if (departmentId != null) {
            headers = headerRepository.findByAcademicYearAndDepartmentId(previousYear, departmentId);
        } else {
            headers = headerRepository.findByAcademicYear(previousYear);
        }

        List<SuppForecastPreviousDTO> result = new java.util.ArrayList<>();

        for (SuppForecastHeader h : headers) {
            for (SuppForecastDetail d : h.getDetails()) {

                SuppForecastPreviousDTO dto = new SuppForecastPreviousDTO();
                dto.setMaterialId(d.getMaterial() != null ? d.getMaterial().getId() : null);
                dto.setMaterialName(d.getMaterial() != null ? d.getMaterial().getName() : null);
                dto.setSpecification(d.getMaterial() != null ? d.getMaterial().getSpec() : null);
                dto.setUnitId(d.getMaterial() != null ? d.getMaterial().getUnitId() : null);
                dto.setMaterialCode(d.getMaterial() != null ? d.getMaterial().getCode() : null);
                dto.setManufacturer(d.getMaterial() != null ? d.getMaterial().getManufacturer() : null);

                dto.setCurrentStock(d.getCurrentStock());
                dto.setPrevYearQty(d.getPrevYearQty());
                dto.setThisYearQty(d.getThisYearQty());

                dto.setJustification("Tự động tạo dự trù"); // AUTO FILL
                dto.setProposedCode(d.getProposedCode());
                dto.setProposedManufacturer(d.getProposedManufacturer());
                dto.setAcademicYear(h.getAcademicYear());

                result.add(dto);
            }
        }

        return result;
    }
}