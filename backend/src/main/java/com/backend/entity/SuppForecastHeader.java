package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
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

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "academic_year")
    private String academicYear;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    private Integer status = 0; // 0 = pending, 1 = approved, 2 = rejected

    @ManyToOne
    @JoinColumn(name = "approval_by")
    private User approvalBy;

    @Column(name = "approval_at")
    private LocalDateTime approvalAt;

    @Column(name = "approval_note")
    private String approvalNote;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL)
    private List<SuppForecastDetail> details = new ArrayList<>();

    public void setDepartmentId(Long departmentId) {
        if (department == null) {
            department = new Department();
        }
        department.setId(departmentId);
    }
}