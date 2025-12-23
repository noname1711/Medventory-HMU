package com.backend.dto;

import lombok.Data;

@Data
public class RbacPermissionDTO {
    private Long id;
    private String code;
    private String name;
    private String description;
}
