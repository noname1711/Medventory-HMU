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
@Table(name = "receipt_header")
@Data
public class ReceiptHeader {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "received_from", length = 255)
    private String receivedFrom;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "receipt_date")
    private LocalDate receiptDate;

    @Column(name = "total_amount", precision = 18, scale = 2)
    private BigDecimal totalAmount;

    @OneToMany(mappedBy = "header", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<ReceiptDetail> details = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (receiptDate == null) receiptDate = LocalDate.now();
        if (totalAmount == null) totalAmount = BigDecimal.ZERO;
    }
}
