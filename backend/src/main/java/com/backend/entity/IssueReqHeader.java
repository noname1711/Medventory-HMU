package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "issue_req_header")
@Data
public class IssueReqHeader {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    @ManyToOne
    @JoinColumn(name = "sub_department_id")
    private SubDepartment subDepartment;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "requested_at")
    private LocalDateTime requestedAt = LocalDateTime.now();

    @Column(nullable = false)
    private Integer status = 0; // 0 = pending, 1 = approved, 2 = rejected

    @ManyToOne
    @JoinColumn(name = "approval_by")
    private User approvalBy;

    @Column(name = "approval_at")
    private LocalDateTime approvalAt;

    @Column(name = "approval_note")
    private String approvalNote;

    private String note;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<IssueReqDetail> details = new ArrayList<>();

    // Helper methods
    public boolean isPending() {
        return status != null && status == 0;
    }

    public boolean isApproved() {
        return status != null && status == 1;
    }

    public boolean isRejected() {
        return status != null && status == 2;
    }

    public String getStatusName() {
        if (status == null) return "Không xác định";
        switch (status) {
            case 0: return "Chờ phê duyệt";
            case 1: return "Đã phê duyệt";
            case 2: return "Đã từ chối";
            default: return "Không xác định";
        }
    }

    public String getStatusBadge() {
        if (status == null) return "secondary";
        switch (status) {
            case 0: return "warning";
            case 1: return "success";
            case 2: return "danger";
            default: return "secondary";
        }
    }
}