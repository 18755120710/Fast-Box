use std::fs;
use std::io::Read;
use std::path::Path;
use sha2::{Digest, Sha256};

/// 流式计算并校验文件的 SHA256 完整性（比对忽略大小写）。
/// 若校验失败，将自动执行物理删除该文件以进行缓存清理，防范死循环。
pub fn verify_file_sha256(file_path: &Path, expected_sha256: &str) -> Result<(), String> {
    if !file_path.exists() {
        return Err(format!("File does not exist: {:?}", file_path));
    }

    let result = (|| -> Result<(), String> {
        let mut file = fs::File::open(file_path)
            .map_err(|e| format!("Failed to open file: {}", e))?;

        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192]; // 8KB chunks

        loop {
            let n = file.read(&mut buffer)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }

        let actual_sha256 = format!("{:x}", hasher.finalize());

        if actual_sha256.eq_ignore_ascii_case(expected_sha256) {
            Ok(())
        } else {
            Err(format!(
                "SHA256 mismatch. Expected: {}, Actual: {}",
                expected_sha256, actual_sha256
            ))
        }
    })();

    if let Err(ref err) = result {
        // 校验失败或发生读取错误，执行缓存清理
        let _ = fs::remove_file(file_path);
        return Err(err.clone());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_verify_file_sha256_success_and_case_insensitive() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("test_verify_sha256_success.txt");

        // 写入测试数据，内容为 "hello world"
        let mut file = fs::File::create(&file_path).unwrap();
        file.write_all(b"hello world").unwrap();

        // "hello world" 的标准 SHA256 哈希值
        let expected_sha256 = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

        // 1. 测试完全一致的哈希值
        let res = verify_file_sha256(&file_path, expected_sha256);
        assert!(res.is_ok());
        assert!(file_path.exists(), "校验成功时，文件不应该被删除");

        // 2. 测试大写的哈希值 (忽略大小写校验)
        let uppercase_sha256 = expected_sha256.to_uppercase();
        let res_upper = verify_file_sha256(&file_path, &uppercase_sha256);
        assert!(res_upper.is_ok());
        assert!(file_path.exists());

        // 清理临时文件
        let _ = fs::remove_file(&file_path);
    }

    #[test]
    fn test_verify_file_sha256_failure_and_cleanup() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("test_verify_sha256_failure.txt");

        // 写入测试数据
        let mut file = fs::File::create(&file_path).unwrap();
        file.write_all(b"some other content").unwrap();

        // 故意提供一个错误的哈希值
        let wrong_sha256 = "0000000000000000000000000000000000000000000000000000000000000000";

        let res = verify_file_sha256(&file_path, wrong_sha256);
        assert!(res.is_err());
        assert!(!file_path.exists(), "校验失败时，残留的损坏文件应当被自动删除以清理缓存");
    }
}
