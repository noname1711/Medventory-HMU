package com.backend.controller;

import com.backend.dto.DepartmentDTO;
import com.backend.service.DepartmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
@CrossOrigin(origins = "http://localhost:5173")
public class DepartmentController {

    @Autowired
    private DepartmentService departmentService;

    @GetMapping
    public List<DepartmentDTO> getAll() {
        return departmentService.getAllDepartments();
    }

    @GetMapping("/{id}")
    public DepartmentDTO getById(@PathVariable Long id) {
        return departmentService.getDepartmentById(id);
    }

    @PostMapping
    public DepartmentDTO create(@RequestBody DepartmentDTO dto) {
        return departmentService.createDepartment(dto);
    }

    @PutMapping("/{id}")
    public DepartmentDTO update(@PathVariable Long id, @RequestBody DepartmentDTO dto) {
        return departmentService.updateDepartment(id, dto);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        departmentService.deleteDepartment(id);
        return "Deleted";
    }
}
