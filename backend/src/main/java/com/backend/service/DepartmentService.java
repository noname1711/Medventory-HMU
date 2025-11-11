package com.backend.service;

import com.backend.entity.Department;
import com.backend.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DepartmentService {

    @Autowired
    private DepartmentRepository departmentRepository;

    public List<Department> searchDepartments(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return departmentRepository.findAll();
        }
        return departmentRepository.findByNameContainingIgnoreCase(keyword.trim());
    }

    public List<Department> getAllDepartments() {
        return departmentRepository.findAll();
    }

    public Department findByName(String name) {
        return departmentRepository.findByName(name).orElse(null);
    }
}