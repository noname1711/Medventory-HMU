package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

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

    @Column(name = "created_at")
    private LocalDate createdAt = LocalDate.now();

    @Column(name = "academic_year")
    private String academicYear;

    @Column(name = "department_id")
    private Integer departmentId;

    @Column(nullable = false)
    private String status = "pending"; // pending, approved, rejected

    @ManyToOne
    @JoinColumn(name = "approval_by")
    private User approvalBy;

    @Column(name = "approval_at")
    private LocalDateTime approvalAt;

    @Column(name = "approval_note", columnDefinition = "text")
    private String approvalNote;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SuppForecastDetail> details = new ArrayList<>();
}
