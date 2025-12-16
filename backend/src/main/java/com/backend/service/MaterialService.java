package com.backend.service;

import com.backend.dto.MaterialDTO;
import com.backend.dto.MaterialFeedItemDTO;
import com.backend.dto.MaterialFeedResponseDTO;
import com.backend.entity.Material;
import com.backend.entity.User;
import com.backend.repository.MaterialRepository;
import com.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MaterialService {

    @Autowired
    private MaterialRepository materialRepository;

    @Autowired
    private UserRepository userRepository;

    public List<MaterialDTO> getAllMaterials() {
        return materialRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }
    // Polling theo afterId
    public MaterialFeedResponseDTO getMaterialFeed(Long userId, Long afterId, Integer limit) {
        try {
            User u = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User không tồn tại"));
            if (!u.isApproved()) {
                throw new RuntimeException("Tài khoản chưa được kích hoạt");
            }

            long cursor = (afterId == null || afterId < 0) ? 0L : afterId;
            int size = (limit == null || limit <= 0) ? 50 : Math.min(limit, 200);

            List<Material> materials = materialRepository
                    .findByIdGreaterThanOrderByIdAsc(cursor, PageRequest.of(0, size));

            List<MaterialFeedItemDTO> items = materials.stream()
                    .map(this::toFeedItem)
                    .collect(Collectors.toList());

            Long lastId = items.isEmpty() ? cursor : items.get(items.size() - 1).getId();

            Map<String, Object> summary = new HashMap<>();
            summary.put("afterId", cursor);
            summary.put("returned", items.size());
            summary.put("limit", size);

            String msg = items.isEmpty() ? "Không có hàng hóa mới" : "Lấy feed hàng hóa mới thành công";
            return MaterialFeedResponseDTO.success(msg, items, lastId, summary);

        } catch (Exception e) {
            return MaterialFeedResponseDTO.error("Không thể lấy feed hàng hóa: " + e.getMessage());
        }
    }

    private MaterialFeedItemDTO toFeedItem(Material material) {
        MaterialFeedItemDTO dto = new MaterialFeedItemDTO();
        dto.setId(material.getId());
        dto.setName(material.getName());
        dto.setSpec(material.getSpec());
        dto.setCode(material.getCode());
        dto.setManufacturer(material.getManufacturer());
        dto.setCategory(material.getCategory() != null ? material.getCategory().toString() : "");

        dto.setUnitId(material.getUnitId());
        dto.setUnitName(material.getUnit() != null ? material.getUnit().getName() : null);

        return dto;
    }

    private MaterialDTO convertToDTO(Material material) {
        MaterialDTO dto = new MaterialDTO();
        dto.setMaterialId(material.getId());
        dto.setMaterialName(material.getName());
        dto.setSpecification(material.getSpec());
        dto.setUnitId(material.getUnitId());
        dto.setManufacturer(material.getManufacturer());
        dto.setMaterialCode(material.getCode());
        dto.setCategory(material.getCategory() != null ? material.getCategory().toString() : "");
        return dto;
    }
}
