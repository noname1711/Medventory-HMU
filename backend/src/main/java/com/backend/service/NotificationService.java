package com.backend.service;

import com.backend.dto.BasicResponseDTO;
import com.backend.dto.NotificationDTO;
import com.backend.dto.NotificationListResponseDTO;
import com.backend.entity.*;
import com.backend.repository.*;
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

    // lookup code (theo schema mới)
    private static final String ENTITY_ISSUE_REQ = "ISSUE_REQ";

    private static final String EVT_PENDING   = "PENDING";
    private static final String EVT_APPROVED  = "APPROVED";
    private static final String EVT_REJECTED  = "REJECTED";
    private static final String EVT_SCHEDULED = "SCHEDULED";

    private final UserRepository userRepository;

    private final NotificationRepository notificationRepository;
    private final NotificationRecipientRepository recipientRepository;

    private final NotificationEntityRepository notificationEntityRepository;
    private final NotificationEventRepository notificationEventRepository;

    private final IssueReqHeaderRepository issueReqHeaderRepository;

    // ===================== CREATE NOTIFICATIONS =====================

    public void notifyLeadersForApproval(IssueReqHeader header) {
        if (header == null || header.getDepartment() == null) return;

        List<User> leaders = userRepository.findByDepartmentId(header.getDepartment().getId())
                .stream()
                .filter(User::isLanhDao)
                .filter(User::isApproved)
                .collect(Collectors.toList());

        if (leaders.isEmpty()) return;

        String title = "Phiếu xin lĩnh #" + header.getId() + " cần phê duyệt";
        String content = "Có phiếu xin lĩnh mới từ "
                + (header.getCreatedBy() != null ? header.getCreatedBy().getFullName() : "cán bộ")
                + ". Nội dung: " + safe(header.getNote());

        createNotificationForUsers(
                ENTITY_ISSUE_REQ,
                header.getId(),
                EVT_PENDING,
                title,
                content,
                leaders
        );
    }

    public void notifyApprovalResult(IssueReqHeader header, boolean approved, String note) {
        if (header == null || header.getCreatedBy() == null) return;

        User requester = header.getCreatedBy();
        if (!requester.isApproved()) return;

        createNotificationForUsers(
                ENTITY_ISSUE_REQ,
                header.getId(),
                approved ? EVT_APPROVED : EVT_REJECTED,
                "Phiếu xin lĩnh #" + header.getId() + (approved ? " đã được phê duyệt" : " bị từ chối"),
                safe(note),
                List.of(requester)
        );
    }

    public void notifyAdjustmentRequest(IssueReqHeader header, String note) {
        if (header == null || header.getCreatedBy() == null) return;

        User requester = header.getCreatedBy();
        if (!requester.isApproved()) return;

        createNotificationForUsers(
                ENTITY_ISSUE_REQ,
                header.getId(),
                EVT_PENDING,
                "Phiếu xin lĩnh #" + header.getId() + " cần điều chỉnh",
                safe(note),
                List.of(requester)
        );
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

            // giữ logic cũ: chỉ hẹn khi đã duyệt
            if (header.getStatus() == null || header.getStatus().getCode() == null
                    || !"APPROVED".equalsIgnoreCase(header.getStatus().getCode())) {
                throw new RuntimeException("Chỉ hẹn lịch cho phiếu đã được phê duyệt");
            }

            if (header.getCreatedBy() == null) {
                throw new RuntimeException("Phiếu không có người tạo để gửi lịch hẹn");
            }

            User requester = header.getCreatedBy();

            String title = "Lịch hẹn đến lĩnh vật tư cho phiếu #" + header.getId();
            String content = "Thời gian: " + scheduledAt
                    + (note == null || note.trim().isEmpty() ? "" : ("\nGhi chú: " + note));

            Notification n = createNotificationForUsers(
                    ENTITY_ISSUE_REQ,
                    header.getId(),
                    EVT_SCHEDULED,
                    title,
                    content,
                    List.of(requester)
            );

            return BasicResponseDTO.ok("Tạo lịch hẹn thành công", Map.of(
                    "notificationId", n.getId(),
                    "issueReqId", header.getId(),
                    "scheduledAt", scheduledAt
            ));

        } catch (Exception e) {
            return BasicResponseDTO.error("Không thể tạo lịch hẹn: " + e.getMessage());
        }
    }

    private Notification createNotificationForUsers(String entityCode,
                                                    Long entityId,
                                                    String eventCode,
                                                    String title,
                                                    String content,
                                                    List<User> users) {

        NotificationEntity entityType = notificationEntityRepository.findByCode(entityCode)
                .orElseThrow(() -> new RuntimeException("Thiếu notification_entity code=" + entityCode));

        NotificationEvent eventType = notificationEventRepository.findByCode(eventCode)
                .orElseThrow(() -> new RuntimeException("Thiếu notification_event code=" + eventCode));

        Notification n = new Notification();
        n.setEntityType(entityType);
        n.setEntityId(entityId);
        n.setEventType(eventType);
        n.setTitle(title);
        n.setContent(content);
        n.setCreatedAt(LocalDateTime.now());

        n = notificationRepository.save(n);

        List<NotificationRecipient> recs = new ArrayList<>();
        for (User u : users) {
            NotificationRecipient r = new NotificationRecipient();
            r.setNotification(n);
            r.setUser(u);
            r.setIsRead(false);
            recs.add(r);
        }
        recipientRepository.saveAll(recs);

        return n;
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
                    ? recipientRepository.findByUser_IdAndIsReadFalseOrderByNotification_CreatedAtDesc(userId, pageable)
                    : recipientRepository.findByUser_IdOrderByNotification_CreatedAtDesc(userId, pageable);

            List<NotificationDTO> items = dataPage.getContent().stream()
                    .map(this::toDTO)
                    .toList();

            long unreadCount = recipientRepository.countByUser_IdAndIsReadFalse(userId);

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
            NotificationRecipient r = recipientRepository.findByNotification_IdAndUser_Id(notificationId, userId)
                    .orElseThrow(() -> new RuntimeException("Thông báo không tồn tại hoặc không thuộc về bạn"));

            if (Boolean.TRUE.equals(r.getIsRead())) {
                return BasicResponseDTO.ok("Thông báo đã ở trạng thái đã đọc", Map.of("id", notificationId));
            }

            r.setIsRead(true);
            r.setReadAt(LocalDateTime.now());
            recipientRepository.save(r);

            return BasicResponseDTO.ok("Đánh dấu đã đọc thành công", Map.of("id", notificationId));

        } catch (Exception e) {
            return BasicResponseDTO.error("Không thể đánh dấu đã đọc: " + e.getMessage());
        }
    }

    public BasicResponseDTO markAllAsRead(Long userId) {
        try {
            User u = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));
            if (!u.isApproved()) throw new RuntimeException("Tài khoản chưa kích hoạt");

            var page = recipientRepository.findByUser_IdAndIsReadFalseOrderByNotification_CreatedAtDesc(
                    userId, PageRequest.of(0, 500)
            );

            for (NotificationRecipient r : page.getContent()) {
                r.setIsRead(true);
                r.setReadAt(LocalDateTime.now());
            }
            recipientRepository.saveAll(page.getContent());

            return BasicResponseDTO.ok("Đánh dấu tất cả đã đọc", Map.of("count", page.getNumberOfElements()));

        } catch (Exception e) {
            return BasicResponseDTO.error("Không thể đánh dấu tất cả: " + e.getMessage());
        }
    }

    private NotificationDTO toDTO(NotificationRecipient r) {
        Notification n = r.getNotification();

        NotificationDTO dto = new NotificationDTO();
        dto.setId(n.getId());

        String entityCode = (n.getEntityType() != null) ? n.getEntityType().getCode() : null;
        String eventCode  = (n.getEventType() != null) ? n.getEventType().getCode() : null;

        // DTO cũ vẫn dùng int để FE không đổi
        dto.setEntityType(entityCodeToInt(entityCode));
        dto.setEntityId(n.getEntityId());
        dto.setEventType(eventCodeToInt(eventCode));

        dto.setTitle(n.getTitle());
        dto.setContent(n.getContent());
        dto.setIsRead(r.getIsRead());
        dto.setCreatedAt(n.getCreatedAt());
        dto.setReadAt(r.getReadAt());
        return dto;
    }

    private int entityCodeToInt(String code) {
        if (code == null) return 0;
        if (ENTITY_ISSUE_REQ.equalsIgnoreCase(code)) return 0;
        return 0;
    }

    private int eventCodeToInt(String code) {
        if (code == null) return 0;
        String c = code.trim().toUpperCase();
        if (EVT_APPROVED.equals(c)) return 1;
        if (EVT_REJECTED.equals(c)) return 2;
        if (EVT_SCHEDULED.equals(c)) return 3;
        return 0; // pending
    }

    private String safe(String s) {
        return s == null ? "" : s.trim();
    }
}
