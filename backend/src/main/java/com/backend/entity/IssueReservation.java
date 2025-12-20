package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "issue_reservations")
@Data
public class IssueReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "issue_req_header_id", nullable = false)
    private IssueReqHeader issueReqHeader;

    @ManyToOne
    @JoinColumn(name = "issue_req_detail_id")
    private IssueReqDetail issueReqDetail;

    @ManyToOne(optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(name = "lot_number", nullable = false, length = 100)
    private String lotNumber;

    @Column(name = "qty_reserved", nullable = false, precision = 18, scale = 3)
    private BigDecimal qtyReserved;

    @ManyToOne(optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    private ReservationStatus status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public boolean isActive() {
        return status != null && "ACTIVE".equalsIgnoreCase(status.getCode());
    }

    public boolean isCancelled() {
        return status != null && "CANCELLED".equalsIgnoreCase(status.getCode());
    }

    public boolean isConsumed() {
        return status != null && "CONSUMED".equalsIgnoreCase(status.getCode());
    }
}
