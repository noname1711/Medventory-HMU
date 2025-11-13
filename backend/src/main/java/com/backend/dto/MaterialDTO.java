package com.backend.dto;

import lombok.Data;

@Data
public class MaterialDTO {
    private Long materialId;
    private String materialName;
    private String specification;
    private Integer unitId;
    private String manufacturer;
    private String materialCode;
}
