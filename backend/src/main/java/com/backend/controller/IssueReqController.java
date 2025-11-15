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
            IssueReqListResponseDTO response = issueReqService.getPendingRequestsForLeader(leaderId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
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
            IssueReqListResponseDTO response = issueReqService.getProcessedRequestsForLeader(leaderId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
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
            IssueReqDetailResponseDTO response = issueReqService.getRequestDetailWithSummary(id, userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
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
            request.setIssueReqId(id);
            request.setApproverId(approverId);
            request.setAction(ApprovalActionDTO.ACTION_APPROVE);
            IssueReqDetailResponseDTO response = issueReqService.processApproval(request);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
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
            request.setIssueReqId(id);
            request.setApproverId(approverId);
            request.setAction(ApprovalActionDTO.ACTION_REJECT);
            IssueReqDetailResponseDTO response = issueReqService.processApproval(request);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
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
            request.setIssueReqId(id);
            request.setApproverId(approverId);
            request.setAction(ApprovalActionDTO.ACTION_REQUEST_ADJUSTMENT);
            IssueReqDetailResponseDTO response = issueReqService.processApproval(request);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(IssueReqDetailResponseDTO.error("Lỗi khi yêu cầu điều chỉnh"));
        }
    }

    // ==================== TẠO PHIẾU XIN LĨNH CHO CÁN BỘ ====================

    @PostMapping("/canbo/create")
    public ResponseEntity<IssueReqDetailResponseDTO> createIssueRequest(
            @RequestBody CreateIssueReqDTO request,
            @RequestHeader("X-User-Id") Long creatorId) {
        try {
            IssueReqDetailResponseDTO response = issueReqService.createIssueRequest(request, creatorId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(IssueReqDetailResponseDTO.error("Lỗi khi tạo phiếu xin lĩnh: " + e.getMessage()));
        }
    }

    @GetMapping("/canbo/my-requests")
    public ResponseEntity<IssueReqListResponseDTO> getCanBoRequests(
            @RequestHeader("X-User-Id") Long canBoId) {
        try {
            IssueReqListResponseDTO response = issueReqService.getRequestsForCanBo(canBoId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(IssueReqListResponseDTO.success(
                    "Chưa có phiếu xin lĩnh nào",
                    new ArrayList<>(),
                    0L, 0, 0, 0
            ));
        }
    }
}