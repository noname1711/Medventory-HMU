package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "receipt_header")
@Data
public class ReceiptHeader {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Thủ kho tạo phiếu
    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "received_from")
    private String receivedFrom;

    @Column(name = "reason")
    private String reason;

    @Column(name = "receipt_date")
    private LocalDate receiptDate = LocalDate.now();

    @Column(name = "total_amount", precision = 18, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ReceiptDetail> details = new ArrayList<>();
}
