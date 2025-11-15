package com.backend.controller;

import com.backend.entity.Material;
import com.backend.repository.MaterialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/materials")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class MaterialController {

    private final MaterialRepository materialRepository;

    @GetMapping
    public ResponseEntity<List<Material>> getAllMaterials() {
        try {
            List<Material> materials = materialRepository.findAll();
            return ResponseEntity.ok(materials);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
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

            Map<String, String> categoryA = new HashMap<>();
            categoryA.put("value", "A");
            categoryA.put("label", "Loại A");
            categoryA.put("description", "Vật tư quan trọng");
            categories.add(categoryA);

            Map<String, String> categoryB = new HashMap<>();
            categoryB.put("value", "B");
            categoryB.put("label", "Loại B");
            categoryB.put("description", "Vật tư thiết yếu");
            categories.add(categoryB);

            Map<String, String> categoryC = new HashMap<>();
            categoryC.put("value", "C");
            categoryC.put("label", "Loại C");
            categoryC.put("description", "Vật tư thông dụng");
            categories.add(categoryC);

            Map<String, String> categoryD = new HashMap<>();
            categoryD.put("value", "D");
            categoryD.put("label", "Loại D");
            categoryD.put("description", "Vật tư ít quan trọng");
            categories.add(categoryD);

            return ResponseEntity.ok(categories);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}