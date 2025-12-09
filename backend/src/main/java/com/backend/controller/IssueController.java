package com.backend.controller;

import com.backend.dto.IssueRequestDTO;
import com.backend.service.IssueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class IssueController {

    private final IssueService issueService;

    @PostMapping("/create-from-request")
    public ResponseEntity<Map<String, Object>> createIssueFromRequest(
            @RequestBody IssueRequestDTO request,
            @RequestHeader("X-User-Id") Long thuKhoId) {
        Map<String, Object> result = issueService.createIssueFromRequest(request, thuKhoId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/approved-requests")
    public ResponseEntity<Map<String, Object>> getApprovedRequests(@RequestHeader("X-User-Id") Long thuKhoId) {
        // Gọi service method (cần thêm method này vào IssueService)
        Map<String, Object> result = issueService.getApprovedRequests(thuKhoId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/my-issues")
    public ResponseEntity<Map<String, Object>> getMyIssues(@RequestHeader("X-User-Id") Long thuKhoId) {
        // Gọi service method (cần thêm method này vào IssueService)
        Map<String, Object> result = issueService.getMyIssues(thuKhoId);
        return ResponseEntity.ok(result);
    }
}