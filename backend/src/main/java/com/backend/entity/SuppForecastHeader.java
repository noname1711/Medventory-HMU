package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "supp_forecast_header")
@Data
public class SuppForecastHeader {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    // DB: created_at DATE DEFAULT CURRENT_DATE
    @Column(name = "created_at")
    private LocalDate createdAt;

    @Column(name = "academic_year", length = 20)
    private String academicYear;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

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

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<SuppForecastDetail> details = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDate.now();
    }

    // giữ helper cũ nếu service đang dùng setDepartmentId
    public void setDepartmentId(Long departmentId) {
        if (department == null) department = new Department();
        department.setId(departmentId);
    }

    public boolean isPending() {
        return status != null && "PENDING".equalsIgnoreCase(status.getCode());
    }

    public boolean isApproved() {
        return status != null && "APPROVED".equalsIgnoreCase(status.getCode());
    }

    public boolean isRejected() {
        return status != null && "REJECTED".equalsIgnoreCase(status.getCode());
    }
}
