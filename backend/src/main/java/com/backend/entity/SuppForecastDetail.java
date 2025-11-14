package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
@Table(name = "supp_forecast_detail")
@Data
public class SuppForecastDetail {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "header_id")
    private SuppForecastHeader header;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    @Column(name = "current_stock")
    private BigDecimal currentStock = BigDecimal.ZERO;

    @Column(name = "prev_year_qty")
    private BigDecimal prevYearQty = BigDecimal.ZERO;

    @Column(name = "this_year_qty")
    private BigDecimal thisYearQty;

    @Column(name = "proposed_code")
    private String proposedCode;

    @Column(name = "proposed_manufacturer")
    private String proposedManufacturer;

    private String justification;
}