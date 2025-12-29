package com.backend.controller;

import com.backend.entity.Unit;
import com.backend.repository.UnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/units")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class UnitController {

    private final UnitRepository unitRepository;

    @GetMapping
    public ResponseEntity<List<Unit>> getAllUnits() {
        try {
            List<Unit> units = unitRepository.findAll();
            return ResponseEntity.ok(units);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}