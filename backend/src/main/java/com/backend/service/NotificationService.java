package com.backend.service;

import com.backend.dto.BasicResponseDTO;
import com.backend.dto.NotificationDTO;
import com.backend.dto.NotificationListResponseDTO;
import com.backend.entity.IssueReqHeader;
import com.backend.entity.Notification;
import com.backend.entity.User;
import com.backend.repository.IssueReqHeaderRepository;
import com.backend.repository.NotificationRepository;
import com.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    // entity_type
    public static final int ENTITY_ISSUE_REQ = 0;

    // event_type
    public static final int EVT_PENDING   = 0;
    public static final int EVT_APPROVED  = 1;
    public static final int EVT_REJECTED  = 2;
    public static final int EVT_SCHEDULED = 3;

    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final IssueReqHeaderRepository issueReqHeaderRepository;

    // ===================== CREATE NOTIFICATIONS =====================

    public void notifyLeadersForApproval(IssueReqHeader header) {
        if (header == null || header.getDepartment() == null) return;

        List<User> leaders = userRepository.findByDepartmentId(header.getDepartment().getId())
                .stream()
                .filter(User::isLanhDao)
                .filter(User::isApproved)
                .collect(Collectors.toList());

        String title = "Phiếu xin lĩnh #" + header.getId() + " cần phê duyệt";
        String content = "Có phiếu xin lĩnh mới từ "
                + (header.getCreatedBy() != null ? header.getCreatedBy().getFullName() : "cán bộ")
                + ". Nội dung: " + safe(header.getNote());

        for (User leader : leaders) {
            Notification n = new Notification();
            n.setUser(leader);
            n.setEntityType(ENTITY_ISSUE_REQ);
            n.setEntityId(header.getId());
            n.setEventType(EVT_PENDING);
            n.setTitle(title);
            n.setContent(content);
            n.setIsRead(false);
            n.setCreatedAt(LocalDateTime.now());
            notificationRepository.save(n);
        }
    }

    public void notifyApprovalResult(IssueReqHeader header, boolean approved, String note) {
        if (header == null || header.getCreatedBy() == null) return;

        User requester = header.getCreatedBy();
        if (!requester.isApproved()) return;

        Notification n = new Notification();
        n.setUser(requester);
        n.setEntityType(ENTITY_ISSUE_REQ);
        n.setEntityId(header.getId());
        n.setEventType(approved ? EVT_APPROVED : EVT_REJECTED);
        n.setTitle("Phiếu xin lĩnh #" + header.getId() + (approved ? " đã được phê duyệt" : " bị từ chối"));
        n.setContent(safe(note));
        n.setIsRead(false);
        n.setCreatedAt(LocalDateTime.now());

        notificationRepository.save(n);
    }

    // Schema không có event riêng cho “adjustment”, ta dùng pending + title/content rõ ràng.
    public void notifyAdjustmentRequest(IssueReqHeader header, String note) {
        if (header == null || header.getCreatedBy() == null) return;

        User requester = header.getCreatedBy();
        if (!requester.isApproved()) return;

        Notification n = new Notification();
        n.setUser(requester);
        n.setEntityType(ENTITY_ISSUE_REQ);
        n.setEntityId(header.getId());
        n.setEventType(EVT_PENDING);
        n.setTitle("Phiếu xin lĩnh #" + header.getId() + " cần điều chỉnh");
        n.setContent(safe(note));
        n.setIsRead(false);
        n.setCreatedAt(LocalDateTime.now());

        notificationRepository.save(n);
    }

    public BasicResponseDTO schedulePickupForIssueReq(Long issueReqId, Long thuKhoId,
                                                      LocalDateTime scheduledAt, String note) {
        try {
            User thuKho = userRepository.findById(thuKhoId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));
            if (!thuKho.isApproved() || !thuKho.isThuKho()) {
                throw new RuntimeException("Chỉ thủ kho được hẹn lịch");
            }

            IssueReqHeader header = issueReqHeaderRepository.findById(issueReqId)
                    .orElseThrow(() -> new RuntimeException("Phiếu xin lĩnh không tồn tại"));

            if (!header.isApproved()) {
                throw new RuntimeException("Chỉ hẹn lịch cho phiếu đã được phê duyệt");
            }

            if (header.getCreatedBy() == null) {
                throw new RuntimeException("Phiếu không có người tạo để gửi lịch hẹn");
            }

            User requester = header.getCreatedBy();

            Notification n = new Notification();
            n.setUser(requester);
            n.setEntityType(ENTITY_ISSUE_REQ);
            n.setEntityId(header.getId());
            n.setEventType(EVT_SCHEDULED);
            n.setTitle("Lịch hẹn đến lĩnh vật tư cho phiếu #" + header.getId());
            n.setContent("Thời gian: " + scheduledAt + (note == null || note.trim().isEmpty() ? "" : ("\nGhi chú: " + note)));
            n.setIsRead(false);
            n.setCreatedAt(LocalDateTime.now());

            notificationRepository.save(n);

            return BasicResponseDTO.ok("Tạo lịch hẹn thành công", Map.of(
                    "notificationId", n.getId(),
                    "issueReqId", header.getId(),
                    "scheduledAt", scheduledAt
            ));

        } catch (Exception e) {
            return BasicResponseDTO.error("Không thể tạo lịch hẹn: " + e.getMessage());
        }
    }

    // ===================== READ NOTIFICATIONS =====================

    public NotificationListResponseDTO getMyNotifications(Long userId, boolean unreadOnly, Integer page, Integer size) {
        try {
            User u = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));
            if (!u.isApproved()) throw new RuntimeException("Tài khoản chưa kích hoạt");

            int p = (page == null || page < 0) ? 0 : page;
            int s = (size == null || size <= 0) ? 20 : Math.min(size, 100);

            var pageable = PageRequest.of(p, s);
            var dataPage = unreadOnly
                    ? notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId, pageable)
                    : notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);

            List<NotificationDTO> items = dataPage.getContent().stream().map(this::toDTO).toList();

            long unreadCount = notificationRepository.countByUserIdAndIsReadFalse(userId);

            Map<String, Object> summary = new HashMap<>();
            summary.put("page", p);
            summary.put("size", s);
            summary.put("totalElements", dataPage.getTotalElements());
            summary.put("totalPages", dataPage.getTotalPages());
            summary.put("unreadCount", unreadCount);

            return NotificationListResponseDTO.success("Lấy danh sách thông báo thành công", items, summary);

        } catch (Exception e) {
            return NotificationListResponseDTO.error("Không thể lấy thông báo: " + e.getMessage());
        }
    }

    public BasicResponseDTO markAsRead(Long userId, Long notificationId) {
        try {
            Notification n = notificationRepository.findById(notificationId)
                    .orElseThrow(() -> new RuntimeException("Thông báo không tồn tại"));

            if (!n.getUser().getId().equals(userId)) {
                throw new RuntimeException("Bạn không có quyền đọc thông báo này");
            }

            if (Boolean.TRUE.equals(n.getIsRead())) {
                return BasicResponseDTO.ok("Thông báo đã ở trạng thái đã đọc", Map.of("id", n.getId()));
            }

            n.setIsRead(true);
            n.setReadAt(LocalDateTime.now());
            notificationRepository.save(n);

            return BasicResponseDTO.ok("Đánh dấu đã đọc thành công", Map.of("id", n.getId()));

        } catch (Exception e) {
            return BasicResponseDTO.error("Không thể đánh dấu đã đọc: " + e.getMessage());
        }
    }

    public BasicResponseDTO markAllAsRead(Long userId) {
        try {
            User u = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));
            if (!u.isApproved()) throw new RuntimeException("Tài khoản chưa kích hoạt");

            // load unread (giới hạn an toàn)
            var page = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId, PageRequest.of(0, 500));
            for (Notification n : page.getContent()) {
                n.setIsRead(true);
                n.setReadAt(LocalDateTime.now());
            }
            notificationRepository.saveAll(page.getContent());

            return BasicResponseDTO.ok("Đánh dấu tất cả đã đọc", Map.of("count", page.getNumberOfElements()));

        } catch (Exception e) {
            return BasicResponseDTO.error("Không thể đánh dấu tất cả: " + e.getMessage());
        }
    }

    private NotificationDTO toDTO(Notification n) {
        NotificationDTO dto = new NotificationDTO();
        dto.setId(n.getId());
        dto.setEntityType(n.getEntityType());
        dto.setEntityId(n.getEntityId());
        dto.setEventType(n.getEventType());
        dto.setTitle(n.getTitle());
        dto.setContent(n.getContent());
        dto.setIsRead(n.getIsRead());
        dto.setCreatedAt(n.getCreatedAt());
        dto.setReadAt(n.getReadAt());
        return dto;
    }

    private String safe(String s) {
        return s == null ? "" : s.trim();
    }
}
