package com.backend.controller;

import com.backend.dto.MaterialDTO;
import com.backend.dto.MaterialFeedResponseDTO;
import com.backend.entity.Material;
import com.backend.repository.MaterialRepository;
import com.backend.service.MaterialService;
import com.backend.service.RbacService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/materials")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class MaterialController {

    private final MaterialRepository materialRepository;
    private final MaterialService materialService;
    private final RbacService rbacService;

    // GET /api/materials (using service DTO)
    @GetMapping
    public ResponseEntity<List<MaterialDTO>> getAllMaterials() {
        List<MaterialDTO> materials = materialService.getAllMaterials();
        return ResponseEntity.ok(materials);
    }

    @GetMapping("/search")
    public ResponseEntity<List<Material>> searchMaterials(
            @RequestParam(value = "keyword", required = false) String keyword) {
        try {
            List<Material> materials;
            if (keyword == null || keyword.trim().isEmpty()) {
                materials = materialRepository.findAll();
            } else {
                materials = materialRepository.findByNameOrCodeContainingIgnoreCase(keyword.trim());
            }
            return ResponseEntity.ok(materials);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/categories")
    public ResponseEntity<List<Map<String, String>>> getMaterialCategories() {
        try {
            List<Map<String, String>> categories = new ArrayList<>();

            categories.add(Map.of("value", "A", "label", "Loại A", "description", "Vật tư quan trọng"));
            categories.add(Map.of("value", "B", "label", "Loại B", "description", "Vật tư thiết yếu"));
            categories.add(Map.of("value", "C", "label", "Loại C", "description", "Vật tư thông dụng"));
            categories.add(Map.of("value", "D", "label", "Loại D", "description", "Vật tư ít quan trọng"));

            return ResponseEntity.ok(categories);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/feed")
    public ResponseEntity<MaterialFeedResponseDTO> feed(
            @RequestParam(value = "afterId", required = false) Long afterId,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestHeader("X-User-Id") Long userId
    ) {
        try {
            return ResponseEntity.ok(materialService.getMaterialFeed(userId, afterId, limit));
        } catch (Exception e) {
            return ResponseEntity.ok(MaterialFeedResponseDTO.error("Không thể lấy feed hàng hóa"));
        }
    }

    @PostMapping
    public ResponseEntity<?> addMaterial(
            @RequestBody MaterialDTO dto,
            @RequestHeader("X-User-Id") Long userId
    ) {
        try {
            rbacService.requirePermission(userId, RbacService.PERM_MATERIAL_MANAGE, "Ban khong co quyen them vat tu");
            return ResponseEntity.ok(materialService.addMaterial(dto));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity
                    .badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
