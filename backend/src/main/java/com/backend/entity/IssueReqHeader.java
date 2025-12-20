package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

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
    private LocalDateTime requestedAt;

    // NEW: FK to doc_status
    @ManyToOne(optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    private DocStatus status;

    @ManyToOne
    @JoinColumn(name = "approval_by")
    private User approvalBy;

    @Column(name = "approval_at")
    private LocalDateTime approvalAt;

    @Column(name = "approval_note", columnDefinition = "TEXT")
    private String approvalNote;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<IssueReqDetail> details = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (requestedAt == null) requestedAt = LocalDateTime.now();
    }

    // ===== Helpers theo code =====
    public boolean isPending() {
        return status != null && "PENDING".equalsIgnoreCase(status.getCode());
    }

    public boolean isApproved() {
        return status != null && "APPROVED".equalsIgnoreCase(status.getCode());
    }

    public boolean isRejected() {
        return status != null && "REJECTED".equalsIgnoreCase(status.getCode());
    }

    public String getStatusName() {
        return status != null ? status.getName() : "Không xác định";
    }

    public String getStatusBadge() {
        if (status == null || status.getCode() == null) return "secondary";
        return switch (status.getCode().toUpperCase()) {
            case "PENDING" -> "warning";
            case "APPROVED" -> "success";
            case "REJECTED" -> "danger";
            default -> "secondary";
        };
    }
}
