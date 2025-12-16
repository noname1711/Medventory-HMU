package com.backend.controller;

import com.backend.dto.BasicResponseDTO;
import com.backend.dto.NotificationListResponseDTO;
import com.backend.dto.SchedulePickupRequestDTO;
import com.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class NotificationController {

    private final NotificationService notificationService;

    // Lấy notifications của tôi
    // GET /api/notifications/my?unreadOnly=true&page=0&size=20
    @GetMapping("/my")
    public ResponseEntity<NotificationListResponseDTO> my(
            @RequestParam(value = "unreadOnly", required = false, defaultValue = "false") boolean unreadOnly,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size,
            @RequestHeader("X-User-Id") Long userId
    ) {
        return ResponseEntity.ok(notificationService.getMyNotifications(userId, unreadOnly, page, size));
    }

    // Mark 1 notification đã đọc
    @PostMapping("/{id}/read")
    public ResponseEntity<BasicResponseDTO> read(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Long userId
    ) {
        return ResponseEntity.ok(notificationService.markAsRead(userId, id));
    }

    // Mark all read
    @PostMapping("/read-all")
    public ResponseEntity<BasicResponseDTO> readAll(
            @RequestHeader("X-User-Id") Long userId
    ) {
        return ResponseEntity.ok(notificationService.markAllAsRead(userId));
    }

    // Hẹn lịch đến lĩnh cho cán bộ theo issueReqId
    @PostMapping("/issue-req/{issueReqId}/schedule")
    public ResponseEntity<BasicResponseDTO> schedulePickup(
            @PathVariable Long issueReqId,
            @RequestBody SchedulePickupRequestDTO req,
            @RequestHeader("X-User-Id") Long thuKhoId
    ) {
        return ResponseEntity.ok(
                notificationService.schedulePickupForIssueReq(issueReqId, thuKhoId, req.getScheduledAt(), req.getNote())
        );
    }
}
