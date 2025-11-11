package com.backend.controller;

import com.backend.dto.*;
import com.backend.service.IssueReqService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;

@RestController
@RequestMapping("/api/issue-requests")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class IssueReqController {

    private final IssueReqService issueReqService;

    // ==================== DANH SÁCH PHIẾU CHO LÃNH ĐẠO ====================

    @GetMapping("/leader/pending")
    public ResponseEntity<IssueReqListResponseDTO> getPendingRequestsForLeader(
            @RequestHeader("X-User-Id") Long leaderId) {
        try {
            System.out.println("=== GET /leader/pending called ===");
            System.out.println("Leader ID: " + leaderId);

            IssueReqListResponseDTO response = issueReqService.getPendingRequestsForLeader(leaderId);
            System.out.println("Response success: " + response.isSuccess());
            System.out.println("Requests count: " + (response.getRequests() != null ? response.getRequests().size() : 0));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.out.println("ERROR in /leader/pending: " + e.getMessage());
            e.printStackTrace();
            // Fallback response nếu có lỗi
            return ResponseEntity.ok(IssueReqListResponseDTO.success(
                    "Không có phiếu nào chờ phê duyệt",
                    new ArrayList<>(),
                    0L, 0, 0, 0
            ));
        }
    }

    @GetMapping("/leader/processed")
    public ResponseEntity<IssueReqListResponseDTO> getProcessedRequestsForLeader(
            @RequestHeader("X-User-Id") Long leaderId) {
        try {
            System.out.println("=== GET /leader/processed called ===");
            System.out.println("Leader ID: " + leaderId);

            IssueReqListResponseDTO response = issueReqService.getProcessedRequestsForLeader(leaderId);
            System.out.println("Response success: " + response.isSuccess());
            System.out.println("Requests count: " + (response.getRequests() != null ? response.getRequests().size() : 0));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.out.println("ERROR in /leader/processed: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(IssueReqListResponseDTO.success(
                    "Chưa có lịch sử phê duyệt",
                    new ArrayList<>(),
                    0L, 0, 0, 0
            ));
        }
    }

    // ==================== CHI TIẾT PHIẾU ====================

    @GetMapping("/{id}/detail")
    public ResponseEntity<IssueReqDetailResponseDTO> getRequestDetail(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Long userId) {
        try {
            System.out.println("=== GET /{id}/detail called ===");
            System.out.println("Request ID: " + id);
            System.out.println("User ID: " + userId);

            IssueReqDetailResponseDTO response = issueReqService.getRequestDetailWithSummary(id, userId);
            System.out.println("Detail response success: " + response.isSuccess());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.out.println("ERROR in /{id}/detail: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(IssueReqDetailResponseDTO.error("Không thể tải chi tiết phiếu"));
        }
    }

    // ==================== THAO TÁC PHÊ DUYỆT ====================

    @PostMapping("/{id}/approve")
    public ResponseEntity<IssueReqDetailResponseDTO> approveRequest(
            @PathVariable Long id,
            @RequestBody ApprovalActionDTO request,
            @RequestHeader("X-User-Id") Long approverId) {
        try {
            System.out.println("=== POST /{id}/approve called ===");
            System.out.println("Request ID: " + id);
            System.out.println("Approver ID: " + approverId);

            request.setIssueReqId(id);
            request.setApproverId(approverId);
            request.setAction(ApprovalActionDTO.ACTION_APPROVE);
            IssueReqDetailResponseDTO response = issueReqService.processApproval(request);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.out.println("ERROR in /{id}/approve: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(IssueReqDetailResponseDTO.error("Lỗi khi phê duyệt phiếu"));
        }
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<IssueReqDetailResponseDTO> rejectRequest(
            @PathVariable Long id,
            @RequestBody ApprovalActionDTO request,
            @RequestHeader("X-User-Id") Long approverId) {
        try {
            System.out.println("=== POST /{id}/reject called ===");
            System.out.println("Request ID: " + id);
            System.out.println("Approver ID: " + approverId);

            request.setIssueReqId(id);
            request.setApproverId(approverId);
            request.setAction(ApprovalActionDTO.ACTION_REJECT);
            IssueReqDetailResponseDTO response = issueReqService.processApproval(request);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.out.println("ERROR in /{id}/reject: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(IssueReqDetailResponseDTO.error("Lỗi khi từ chối phiếu"));
        }
    }

    @PostMapping("/{id}/request-adjustment")
    public ResponseEntity<IssueReqDetailResponseDTO> requestAdjustment(
            @PathVariable Long id,
            @RequestBody ApprovalActionDTO request,
            @RequestHeader("X-User-Id") Long approverId) {
        try {
            System.out.println("=== POST /{id}/request-adjustment called ===");
            System.out.println("Request ID: " + id);
            System.out.println("Approver ID: " + approverId);

            request.setIssueReqId(id);
            request.setApproverId(approverId);
            request.setAction(ApprovalActionDTO.ACTION_REQUEST_ADJUSTMENT);
            IssueReqDetailResponseDTO response = issueReqService.processApproval(request);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.out.println("ERROR in /{id}/request-adjustment: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(IssueReqDetailResponseDTO.error("Lỗi khi yêu cầu điều chỉnh"));
        }
    }
}