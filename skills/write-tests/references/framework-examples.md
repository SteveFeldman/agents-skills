# Framework-Specific Test Examples

Reference examples for common testing frameworks. Use the patterns that match the project's framework.

## Jest / Vitest (JavaScript/TypeScript)

```javascript
describe('UserService', () => {
  let service;
  let mockDb;

  beforeEach(() => {
    mockDb = { findById: jest.fn(), save: jest.fn() };
    service = new UserService(mockDb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      // Arrange
      const expectedUser = { id: '1', name: 'Alice' };
      mockDb.findById.mockResolvedValue(expectedUser);

      // Act
      const result = await service.getUser('1');

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockDb.findById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      mockDb.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUser('999')).rejects.toThrow(NotFoundError);
    });

    it('should handle empty string id', async () => {
      await expect(service.getUser('')).rejects.toThrow('ID is required');
    });
  });
});
```

### Mocking patterns (Jest)

```javascript
// Mock a module
jest.mock('./database');

// Mock a specific function
const spy = jest.spyOn(object, 'method').mockReturnValue('mocked');

// Mock timers
jest.useFakeTimers();
jest.advanceTimersByTime(1000);

// Mock fetch/HTTP
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'test' }),
});
```

## pytest (Python)

```python
import pytest
from unittest.mock import Mock, patch, AsyncMock
from myapp.services import UserService
from myapp.exceptions import NotFoundError


class TestUserService:
    def setup_method(self):
        self.mock_db = Mock()
        self.service = UserService(db=self.mock_db)

    def test_get_user_returns_user_when_found(self):
        # Arrange
        expected_user = {"id": "1", "name": "Alice"}
        self.mock_db.find_by_id.return_value = expected_user

        # Act
        result = self.service.get_user("1")

        # Assert
        assert result == expected_user
        self.mock_db.find_by_id.assert_called_once_with("1")

    def test_get_user_raises_not_found_when_missing(self):
        # Arrange
        self.mock_db.find_by_id.return_value = None

        # Act & Assert
        with pytest.raises(NotFoundError):
            self.service.get_user("999")

    @pytest.mark.parametrize("invalid_id", ["", None, 0])
    def test_get_user_rejects_invalid_ids(self, invalid_id):
        with pytest.raises(ValueError, match="ID is required"):
            self.service.get_user(invalid_id)


# Fixtures
@pytest.fixture
def sample_user():
    return {"id": "1", "name": "Alice", "email": "alice@example.com"}


@pytest.fixture
def mock_http_client():
    with patch("myapp.services.http_client") as mock:
        mock.get = AsyncMock(return_value={"status": 200})
        yield mock
```

## RSpec (Ruby)

```ruby
RSpec.describe UserService do
  let(:db) { instance_double(Database) }
  let(:service) { described_class.new(db: db) }

  describe '#get_user' do
    context 'when user exists' do
      let(:user) { { id: '1', name: 'Alice' } }

      before do
        allow(db).to receive(:find_by_id).with('1').and_return(user)
      end

      it 'returns the user' do
        result = service.get_user('1')
        expect(result).to eq(user)
      end

      it 'queries the database with the correct id' do
        service.get_user('1')
        expect(db).to have_received(:find_by_id).with('1')
      end
    end

    context 'when user does not exist' do
      before do
        allow(db).to receive(:find_by_id).and_return(nil)
      end

      it 'raises NotFoundError' do
        expect { service.get_user('999') }.to raise_error(NotFoundError)
      end
    end

    context 'with invalid id' do
      it 'raises ArgumentError for empty string' do
        expect { service.get_user('') }.to raise_error(ArgumentError, /ID is required/)
      end
    end
  end
end
```

## JUnit 5 (Java/Kotlin)

```java
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserServiceTest {
    private Database mockDb;
    private UserService service;

    @BeforeEach
    void setUp() {
        mockDb = mock(Database.class);
        service = new UserService(mockDb);
    }

    @Test
    @DisplayName("getUser returns user when found")
    void getUserReturnsUserWhenFound() {
        // Arrange
        User expected = new User("1", "Alice");
        when(mockDb.findById("1")).thenReturn(Optional.of(expected));

        // Act
        User result = service.getUser("1");

        // Assert
        assertEquals(expected, result);
        verify(mockDb).findById("1");
    }

    @Test
    @DisplayName("getUser throws NotFoundException when user missing")
    void getUserThrowsWhenNotFound() {
        when(mockDb.findById("999")).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.getUser("999"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @DisplayName("getUser rejects invalid IDs")
    void getUserRejectsInvalidIds(String id) {
        assertThrows(IllegalArgumentException.class, () -> service.getUser(id));
    }
}
```

## Go (testing + testify)

```go
package service

import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

type MockDB struct {
    mock.Mock
}

func (m *MockDB) FindByID(id string) (*User, error) {
    args := m.Called(id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*User), args.Error(1)
}

func TestGetUser_ReturnsUserWhenFound(t *testing.T) {
    // Arrange
    mockDB := new(MockDB)
    service := NewUserService(mockDB)
    expected := &User{ID: "1", Name: "Alice"}
    mockDB.On("FindByID", "1").Return(expected, nil)

    // Act
    result, err := service.GetUser("1")

    // Assert
    assert.NoError(t, err)
    assert.Equal(t, expected, result)
    mockDB.AssertExpectations(t)
}

func TestGetUser_ReturnsErrorWhenNotFound(t *testing.T) {
    mockDB := new(MockDB)
    service := NewUserService(mockDB)
    mockDB.On("FindByID", "999").Return(nil, ErrNotFound)

    _, err := service.GetUser("999")

    assert.ErrorIs(t, err, ErrNotFound)
}
```
