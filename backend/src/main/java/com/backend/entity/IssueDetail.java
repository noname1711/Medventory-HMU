package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;

@Entity
@Table(name = "issue_detail")
@Data
public class IssueDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "header_id")
    private IssueHeader header;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    // snapshot fields
    private String name;
    private String spec;
    private String code;

    @ManyToOne
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Column(name = "unit_price", precision = 18, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "qty_requested", precision = 18, scale = 3)
    private BigDecimal qtyRequested;

    @Column(name = "qty_issued", precision = 18, scale = 3)
    private BigDecimal qtyIssued;

    @Column(precision = 18, scale = 2)
    private BigDecimal total;
}
