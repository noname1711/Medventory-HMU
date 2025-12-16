package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "issue_header")
@Data
public class IssueHeader {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Thủ kho tạo phiếu xuất
    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "receiver_name")
    private String receiverName;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "issue_date")
    private LocalDate issueDate = LocalDate.now();

    @Column(name = "total_amount", precision = 18, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<IssueDetail> details = new ArrayList<>();
}
