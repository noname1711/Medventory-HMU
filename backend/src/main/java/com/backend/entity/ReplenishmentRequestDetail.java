package com.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "replenishment_request_details")
public class ReplenishmentRequestDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "request_id")
    private ReplenishmentRequest request;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    private String materialName;
    private String spec;

    @ManyToOne
    @JoinColumn(name = "unit_id")
    private Unit unit;

    private String proposedCode;
    private String proposedManufacturer;

    private Double qtyRequested;
}
