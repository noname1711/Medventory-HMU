package com.backend.service;

import com.backend.entity.IssueReqHeader;
import com.backend.entity.User;
import com.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final UserRepository userRepository;

    public void notifyLeadersForApproval(IssueReqHeader header) {
        // Tìm lãnh đạo trong department
        List<User> leaders = userRepository.findByDepartmentId(header.getDepartment().getId())
                .stream()
                .filter(User::isLanhDao)
                .filter(User::isApproved)
                .collect(java.util.stream.Collectors.toList());

        // TODO: Implement actual notification (email, websocket, etc.)
        System.out.println("🔔 Thông báo: Có phiếu xin lĩnh mới #" + header.getId() + " cần phê duyệt");
        leaders.forEach(leader ->
                System.out.println("Gửi thông báo đến: " + leader.getFullName() + " (" + leader.getEmail() + ")")
        );
    }

    public void notifyApprovalResult(IssueReqHeader header, boolean approved, String note) {
        User requester = header.getCreatedBy();
        String action = approved ? "được phê duyệt" : "bị từ chối";
        String emoji = approved ? "✅" : "❌";

        // TODO: Implement actual notification
        System.out.println(emoji + " Thông báo: Phiếu xin lĩnh #" + header.getId() + " đã " + action);
        System.out.println("Người gửi: " + requester.getFullName() + " (" + requester.getEmail() + ")");
        System.out.println("Ghi chú: " + note);
    }

    public void notifyAdjustmentRequest(IssueReqHeader header, String note) {
        User requester = header.getCreatedBy();

        // TODO: Implement actual notification
        System.out.println("Thông báo: Phiếu xin lĩnh #" + header.getId() + " cần điều chỉnh");
        System.out.println("Người gửi: " + requester.getFullName() + " (" + requester.getEmail() + ")");
        System.out.println("Yêu cầu điều chỉnh: " + note);
    }
}