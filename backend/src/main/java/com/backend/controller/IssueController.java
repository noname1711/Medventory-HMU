package com.backend.controller;

import com.backend.dto.*;
import com.backend.service.IssueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class IssueController {

    private final IssueService issueService;

    // Preview FEFO allocation cho 1 phiếu xin lĩnh đã duyệt
    @GetMapping("/preview")
    public ResponseEntity<IssuePreviewResponseDTO> preview(
            @RequestParam("issueReqId") Long issueReqId,
            @RequestHeader("X-User-Id") Long thuKhoId) {
        try {
            return ResponseEntity.ok(issueService.previewIssueFromApprovedRequest(issueReqId, thuKhoId));
        } catch (Exception e) {
            return ResponseEntity.ok(IssuePreviewResponseDTO.error("Không thể preview: " + e.getMessage()));
        }
    }

    // Tạo phiếu xuất từ phiếu xin lĩnh đã duyệt (auto FEFO hoặc manual)
    @PostMapping("/create-from-issue-req")
    public ResponseEntity<IssueResponseDTO> createFromIssueReq(
            @RequestBody CreateIssueFromReqDTO request,
            @RequestHeader("X-User-Id") Long thuKhoId) {
        try {
            return ResponseEntity.ok(issueService.createIssueFromApprovedRequest(request, thuKhoId));
        } catch (Exception e) {
            return ResponseEntity.ok(IssueResponseDTO.error("Lỗi khi xuất kho: " + e.getMessage()));
        }
    }

    // Lấy chi tiết phiếu xuất
    @GetMapping("/{id}/detail")
    public ResponseEntity<IssueResponseDTO> detail(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Long userId) {
        try {
            return ResponseEntity.ok(issueService.getIssueDetail(id, userId));
        } catch (Exception e) {
            return ResponseEntity.ok(IssueResponseDTO.error("Không thể tải phiếu xuất"));
        }
    }

    // Danh sách lô còn tồn cho 1 vật tư (phục vụ chọn thủ công)
    @GetMapping("/materials/{materialId}/lots")
    public ResponseEntity<List<LotStockDTO>> lots(
            @PathVariable Long materialId,
            @RequestHeader("X-User-Id") Long thuKhoId) {
        try {
            return ResponseEntity.ok(issueService.getAvailableLotsForMaterial(materialId, thuKhoId));
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    @GetMapping("/eligible-requests")
    public ResponseEntity<EligibleIssueReqListResponseDTO> eligibleRequests(
            @RequestParam(value = "departmentId", required = false) Long departmentId,
            @RequestParam(value = "subDepartmentId", required = false) Long subDepartmentId,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestHeader("X-User-Id") Long thuKhoId) {
        try {
            return ResponseEntity.ok(issueService.getEligibleApprovedRequests(thuKhoId, departmentId, subDepartmentId, limit));
        } catch (Exception e) {
            return ResponseEntity.ok(EligibleIssueReqListResponseDTO.error("Không thể lấy eligible: " + e.getMessage()));
        }
    }

    @GetMapping("/eligible-requests-with-reasons")
    public ResponseEntity<EligibleIssueReqResponseDTO> eligibleRequestsWithReasons(
            @RequestParam(value = "departmentId", required = false) Long departmentId,
            @RequestParam(value = "subDepartmentId", required = false) Long subDepartmentId,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestHeader("X-User-Id") Long thuKhoId) {
        try {
            return ResponseEntity.ok(
                    issueService.getEligibleApprovedRequestsWithReasons(thuKhoId, departmentId, subDepartmentId, limit)
            );
        } catch (Exception e) {
            return ResponseEntity.ok(EligibleIssueReqResponseDTO.error("Không thể lấy eligible: " + e.getMessage()));
        }
    }
}
