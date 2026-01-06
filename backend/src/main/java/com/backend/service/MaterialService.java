package com.backend.service;

import com.backend.dto.MaterialDTO;
import com.backend.dto.MaterialFeedItemDTO;
import com.backend.dto.MaterialFeedResponseDTO;
import com.backend.entity.Material;
import com.backend.entity.User;
import com.backend.entity.Unit;
import com.backend.repository.MaterialRepository;
import com.backend.repository.UserRepository;
import com.backend.repository.UnitRepository;
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

    @Autowired
    private UnitRepository unitRepository;

    public MaterialDTO addMaterial(MaterialDTO dto) {

        // 1. Validate bắt buộc
        if (dto.getMaterialCode() == null || dto.getMaterialCode().isBlank())
            throw new RuntimeException("Mã vật tư không được để trống");

        if (materialRepository.existsByCode(dto.getMaterialCode()))
            throw new RuntimeException("Mã vật tư đã tồn tại");

        if (dto.getMaterialName() == null || dto.getMaterialName().isBlank())
            throw new RuntimeException("Tên vật tư không được để trống");

        if (dto.getSpecification() == null || dto.getSpecification().isBlank())
            throw new RuntimeException("Quy cách đóng gói không được để trống");

        if (dto.getUnitId() == null)
            throw new RuntimeException("Chưa chọn đơn vị tính");

        if (dto.getManufacturer() == null || dto.getManufacturer().isBlank())
            throw new RuntimeException("Hãng sản xuất không được để trống");

        if (!List.of("A","B","C","D").contains(dto.getCategory()))
            throw new RuntimeException("Phân loại vật tư không hợp lệ");

        // 2. Lấy UnitEntity
        Unit unit = unitRepository.findById(dto.getUnitId())
                .orElseThrow(() -> new RuntimeException("Đơn vị tính không tồn tại"));

        // 3. Map DTO → Entity
        Material material = new Material();
        material.setName(dto.getMaterialName());
        material.setSpec(dto.getSpecification());
        material.setCode(dto.getMaterialCode());
        material.setManufacturer(dto.getManufacturer());
        material.setCategory(dto.getCategory());
        material.setUnit(unit);

        // 4. Save
        Material saved = materialRepository.save(material);

        // 5. Trả DTO
        MaterialDTO res = new MaterialDTO();
        res.setMaterialId(saved.getId());
        res.setMaterialName(saved.getName());
        res.setSpecification(saved.getSpec());
        res.setMaterialCode(saved.getCode());
        res.setManufacturer(saved.getManufacturer());
        res.setCategory(saved.getCategory());
        res.setUnitId(unit.getId());
        res.setUnitName(unit.getName());

        return res;
    }

    public List<MaterialDTO> getAllMaterials() {
        return materialRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

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

        // category là String (A/B/C/D)
        dto.setCategory(material.getCategory() != null ? material.getCategory() : "");

        Long unitId = (material.getUnit() != null) ? material.getUnit().getId() : null;
        dto.setUnitId(unitId);
        dto.setUnitName(material.getUnit() != null ? material.getUnit().getName() : null);

        return dto;
    }

    private MaterialDTO convertToDTO(Material material) {
        MaterialDTO dto = new MaterialDTO();
        dto.setMaterialId(material.getId());
        dto.setMaterialName(material.getName());
        dto.setSpecification(material.getSpec());
        dto.setManufacturer(material.getManufacturer());
        dto.setMaterialCode(material.getCode());

        dto.setCategory(material.getCategory() != null ? material.getCategory() : "");
        dto.setUnitId(material.getUnit() != null ? material.getUnit().getId() : null);

        return dto;
    }
}
