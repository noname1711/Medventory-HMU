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

    @ManyToOne
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy; // Thủ kho tạo phiếu

    @Column(name = "received_from", length = 255)
    private String receivedFrom; // Nhập từ NCC nào

    private String reason; // Lý do nhập

    @Column(name = "receipt_date")
    private LocalDate receiptDate = LocalDate.now(); // Ngày nhập

    @Column(name = "total_amount", precision = 18, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ReceiptDetail> details = new ArrayList<>();
}