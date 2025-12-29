package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

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

    // NEW: liên kết phiếu xin lĩnh (nullable)
    @ManyToOne
    @JoinColumn(name = "issue_req_id")
    private IssueReqHeader issueReq;

    @Column(name = "receiver_name", length = 255)
    private String receiverName;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "total_amount", precision = 18, scale = 2)
    private BigDecimal totalAmount;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<IssueDetail> details = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (issueDate == null) issueDate = LocalDate.now();
        if (totalAmount == null) totalAmount = BigDecimal.ZERO;
    }

    // Helpers giữ như bạn đang dùng
    public void addDetail(IssueDetail d) {
        if (d == null) return;
        this.details.add(d);
        d.setHeader(this);
    }

    public void removeDetail(IssueDetail d) {
        if (d == null) return;
        this.details.remove(d);
        d.setHeader(null);
    }

    public void clearDetails() {
        for (int i = this.details.size() - 1; i >= 0; i--) {
            IssueDetail d = this.details.get(i);
            removeDetail(d);
        }
    }
}
