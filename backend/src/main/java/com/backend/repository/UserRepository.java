package com.backend.repository;

import com.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailAndPassword(String email, String password); // THÊM METHOD NÀY
    List<User> findByStatus(Integer status); // ĐỔI String -> Integer
    boolean existsByEmail(String email);
    List<User> findByDepartmentId(Long departmentId);
}