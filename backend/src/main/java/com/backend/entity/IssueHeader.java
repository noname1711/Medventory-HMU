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

    @ManyToOne
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy; // Thủ kho tạo phiếu

    @Column(name = "receiver_name", length = 255)
    private String receiverName; // Người nhận hàng

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department; // Khoa/phòng nhận

    @Column(name = "issue_date")
    private LocalDate issueDate = LocalDate.now(); // Ngày xuất

    @Column(name = "total_amount", precision = 18, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @ManyToOne
    @JoinColumn(name = "issue_req_id")
    private IssueReqHeader issueReq; // Link đến phiếu xin lĩnh đã duyệt

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<IssueDetail> details = new ArrayList<>();
}