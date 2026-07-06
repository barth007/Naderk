class StorageError(Exception):
    pass

class StorageValidationError(StorageError):
    pass

class StorageProviderError(StorageError):
    pass
