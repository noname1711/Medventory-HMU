package com.backend.service;

import com.backend.dto.RegisterRequest;
import com.backend.dto.UserDTO;
import com.backend.entity.User;
import com.backend.entity.Department;
import com.backend.entity.Role;
import com.backend.entity.Status;
import com.backend.repository.UserRepository;
import com.backend.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    public User registerUser(RegisterRequest request) {
        try {
            // CHỈ CHO PHÉP ĐĂNG KÝ VỚI KHOA ĐÃ CÓ TRONG DB
            Department department = departmentRepository.findByName(request.getDepartment())
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy khoa: " + request.getDepartment() + ". Vui lòng chọn khoa có sẵn trong hệ thống."));

            User user = new User();
            user.setFullName(request.getFullName());
            user.setEmail(request.getEmail());
            user.setPassword(request.getPassword());
            user.setDateOfBirth(request.getDateOfBirth());
            user.setDepartment(department);

            // Xử lý role
            String roleStr = request.getRole();
            if (roleStr != null) {
                try {
                    user.setRole(Role.valueOf(roleStr));
                } catch (IllegalArgumentException e) {
                    user.setRole(Role.canbo);
                }
            } else {
                user.setRole(Role.canbo);
            }

            user.setStatus(Status.pending);

            return userRepository.save(user);
        } catch (Exception e) {
            throw new RuntimeException("Lỗi đăng ký: " + e.getMessage(), e);
        }
    }

    public User authenticateUser(String email, String password) {
        return userRepository.findByEmail(email)
                .filter(user -> user.getPassword().equals(password))
                .filter(user -> user.getStatus() == Status.approved)
                .orElse(null);
    }

    public List<UserDTO> getPendingUsers() {
        return userRepository.findByStatus("pending")
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<UserDTO> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public boolean updateUserStatus(Long userId, String status) {
        return userRepository.findById(userId)
                .map(user -> {
                    // Dùng trực tiếp enum
                    user.setStatus(Status.valueOf(status));
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }

    public UserDTO convertToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setFullName(user.getFullName());
        dto.setEmail(user.getEmail());
        dto.setDateOfBirth(user.getDateOfBirth());
        dto.setDepartment(user.getDepartment() != null ? user.getDepartment().getName() : null);

        // Trả về trực tiếp enum name
        dto.setRole(user.getRole().name());
        dto.setStatus(user.getStatus().name());

        return dto;
    }

    public boolean emailExists(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean deleteUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            return false;
        }
        userRepository.deleteById(userId);
        return true;
    }

    public boolean updateUserRole(Long userId, String newRole) {
        return userRepository.findById(userId)
                .map(user -> {
                    // Dùng trực tiếp enum
                    user.setRole(Role.valueOf(newRole));
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }

    public boolean updatePassword(String email, String newPassword) {
        return userRepository.findByEmail(email)
                .map(user -> {
                    user.setPassword(newPassword);
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }

    public List<Department> getAllDepartments() {
        return departmentRepository.findAll();
    }
}