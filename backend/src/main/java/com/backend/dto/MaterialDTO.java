package com.backend.dto;

import lombok.Data;

@Data
public class MaterialDTO {
    private Long id;
    private String materialName;
    private String specification;
    private String unit;
    private String manufacturer;
    private String materialCode;
}
