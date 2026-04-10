import pytest
from app.models import User
from app.services.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    ALGORITHM
)
from jose import jwt


class TestPasswordHashing:
    """Test password hashing functions."""

    def test_get_password_hash_returns_string(self):
        """Hash should return a non-empty string."""
        hashed = get_password_hash("testpassword123")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_get_password_hash_different_hashes(self):
        """Same password should produce different hashes (due to salt)."""
        hash1 = get_password_hash("testpassword123")
        hash2 = get_password_hash("testpassword123")
        assert hash1 != hash2

    def test_verify_password_correct(self):
        """Should return True for correct password."""
        hashed = get_password_hash("testpassword123")
        assert verify_password("testpassword123", hashed) is True

    def test_verify_password_incorrect(self):
        """Should return False for incorrect password."""
        hashed = get_password_hash("testpassword123")
        assert verify_password("wrongpassword", hashed) is False

    def test_verify_password_empty(self):
        """Should return False for empty password."""
        hashed = get_password_hash("testpassword123")
        assert verify_password("", hashed) is False


class TestTokenGeneration:
    """Test JWT token generation."""

    def test_create_access_token_returns_string(self):
        """Token should be a non-empty string."""
        token = create_access_token(data={"sub": "testuser"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_contains_sub(self):
        """Token should contain the subject."""
        import os
        os.environ["SECRET_KEY"] = "test_secret_key_for_testing_only_12345678901234567890"
        token = create_access_token(data={"sub": "testuser"})
        payload = jwt.decode(token, "test_secret_key_for_testing_only_12345678901234567890", algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"

    def test_create_access_token_has_expiry(self):
        """Token should have an exp claim."""
        import os
        os.environ["SECRET_KEY"] = "test_secret_key_for_testing_only_12345678901234567890"
        token = create_access_token(data={"sub": "testuser"})
        payload = jwt.decode(token, "test_secret_key_for_testing_only_12345678901234567890", algorithms=[ALGORITHM], options={"verify_exp": False})
        assert "exp" in payload


class TestAuthEndpoints:
    """Test authentication API endpoints."""

    def test_login_success(self, client, test_user):
        """Login should return access token for valid credentials."""
        response = client.post(
            "/auth/login",
            data={"username": "testuser", "password": "testpassword123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_invalid_username(self, client, test_user):
        """Login should fail for non-existent username."""
        response = client.post(
            "/auth/login",
            data={"username": "nonexistent", "password": "testpassword123"}
        )
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_invalid_password(self, client, test_user):
        """Login should fail for wrong password."""
        response = client.post(
            "/auth/login",
            data={"username": "testuser", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_rate_limiting(self, client, test_user):
        """Login should be rate limited after multiple attempts."""
        # Make 6 rapid login attempts (limit is 5/minute)
        for _ in range(6):
            response = client.post(
                "/auth/login",
                data={"username": "testuser", "password": "wrongpassword"}
            )
        
        # 6th attempt should be rate limited
        assert response.status_code == 429

    def test_get_current_user(self, client, test_user, auth_headers):
        """Should return user info for authenticated request."""
        response = client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

    def test_get_current_user_unauthenticated(self, client, test_user):
        """Should return 401 for unauthenticated request."""
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_list_users(self, client, test_user, auth_headers):
        """Should list users for authenticated request."""
        response = client.get("/auth/users", headers=auth_headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) >= 1

    def test_list_users_unauthenticated(self, client, test_user):
        """Should return 401 for unauthenticated request."""
        response = client.get("/auth/users")
        assert response.status_code == 401

    def test_create_user(self, client, test_user, auth_headers):
        """Should create new user."""
        response = client.post(
            "/auth/register",
            headers=auth_headers,
            json={
                "username": "newuser",
                "email": "new@example.com",
                "password": "newpassword123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "new@example.com"

    def test_create_duplicate_user(self, client, test_user, auth_headers):
        """Should fail when creating duplicate username."""
        response = client.post(
            "/auth/register",
            headers=auth_headers,
            json={
                "username": "testuser",
                "email": "another@example.com",
                "password": "password123"
            }
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_change_password(self, client, test_user, auth_headers):
        """Should allow user to change their own password."""
        response = client.post(
            "/auth/change-password",
            headers=auth_headers,
            json={
                "old_password": "testpassword123",
                "new_password": "newpassword456"
            }
        )
        assert response.status_code == 200
        
        # Verify new password works
        response = client.post(
            "/auth/login",
            data={"username": "testuser", "password": "newpassword456"}
        )
        assert response.status_code == 200

    def test_change_password_wrong_old(self, client, test_user, auth_headers):
        """Should fail when old password is incorrect."""
        response = client.post(
            "/auth/change-password",
            headers=auth_headers,
            json={
                "old_password": "wrongpassword",
                "new_password": "newpassword456"
            }
        )
        assert response.status_code == 400
        assert "incorrecta" in response.json()["detail"]


class TestHealthEndpoint:
    """Test health check endpoint."""

    def test_root_endpoint(self, client):
        """Root endpoint should return message."""
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()

    def test_health_endpoint(self, client):
        """Health endpoint should return status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data