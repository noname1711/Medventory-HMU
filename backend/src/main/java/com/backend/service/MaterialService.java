package com.backend.service;

import com.backend.dto.MaterialDTO;
import com.backend.entity.Material;
import com.backend.repository.MaterialRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class MaterialService {

    @Autowired
    private MaterialRepository materialRepository;

    public List<MaterialDTO> getAllMaterials() {
        return materialRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private MaterialDTO convertToDTO(Material material) {
        MaterialDTO dto = new MaterialDTO();
        dto.setId(material.getId());
        dto.setMaterialName(material.getName());       // ✅ đúng field DB
        dto.setSpecification(material.getSpec());      // ✅ đúng field DB
        dto.setUnitId(material.getUnitId()); // ✅ về FE hiển thị tên unit
        dto.setManufacturer(material.getManufacturer());
        dto.setMaterialCode(material.getCode());       // ✅ đúng theo DB
        return dto;
    }
}

