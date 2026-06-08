use std::path::Path;
use std::time::Duration;
use futures_util::StreamExt;
use reqwest::Client;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

/// 流式下载函数，带镜像备用和重试机制。
///
/// # 参数
/// * `urls` - 下载候选 URL 列表（通常首个为官方 URL，后续为国内镜像如华为云等）。
/// * `dest` - 下载的目标文件保存路径。
/// * `progress_callback` - 进度回调函数，接收 (已下载字节数, 总字节数)。
pub async fn download_with_retry<F>(
    urls: &[String],
    dest: &Path,
    mut progress_callback: F,
) -> Result<(), String>
where
    F: FnMut(u64, u64) + Send + 'static,
{
    if urls.is_empty() {
        return Err("未提供下载 URL 地址".to_string());
    }

    // 构造具备超时控制的 reqwest::Client
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600)) // 整体超时限制设置为10分钟，适用于大文件
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut last_error = String::new();

    // 依次尝试 URL 列表
    for url in urls {
        let mut attempt = 0;
        let max_attempts = 3;

        while attempt < max_attempts {
            attempt += 1;
            println!("开始下载: {}, 第 {}/{} 次尝试", url, attempt, max_attempts);

            match attempt_download(&client, url, dest, &mut progress_callback).await {
                Ok(_) => {
                    println!("下载成功: {}", url);
                    return Ok(());
                }
                Err(e) => {
                    last_error = format!("URL: {}, 第 {} 次尝试失败: {}", url, attempt, e);
                    eprintln!("{}", last_error);

                    // 在下一次尝试前进行指数退避延迟
                    if attempt < max_attempts {
                        let delay = Duration::from_secs(2u64.pow(attempt as u32));
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }
    }

    // 下载完全失败，物理删除写入半截的临时下载文件
    let _ = tokio::fs::remove_file(dest).await;

    Err(format!(
        "尝试了所有候选 URL 及重试，下载最终失败。最后一次错误: {}",
        last_error
    ))
}

/// 执行单次下载尝试的内部函数
async fn attempt_download<F>(
    client: &Client,
    url: &str,
    dest: &Path,
    progress_callback: &mut F,
) -> Result<(), String>
where
    F: FnMut(u64, u64) + Send + 'static,
{
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("网络请求发起失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("服务器返回错误状态码: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);

    // 确保目标目录存在
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建目标保存目录失败: {}", e))?;
    }

    let mut file = File::create(dest)
        .await
        .map_err(|e| format!("创建目标文件失败: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut last_percent = 0;

    // 初始通知一次 0% 进度
    progress_callback(0, total_size);

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("读取响应流数据块失败: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写入文件失败: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = ((downloaded as f64 / total_size as f64) * 100.0) as u64;
            if percent > last_percent || downloaded == total_size {
                last_percent = percent;
                progress_callback(downloaded, total_size);
            }
        } else {
            progress_callback(downloaded, 0);
        }
    }

    // 确保数据全部刷盘
    file.flush()
        .await
        .map_err(|e| format!("刷盘输出文件失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio::io::AsyncReadExt;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    async fn start_mock_server(with_content_length: bool) -> (String, tokio::task::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let addr = format!("http://127.0.0.1:{}", port);

        let handle = tokio::spawn(async move {
            if let Ok((mut socket, _)) = listener.accept().await {
                let mut buf = [0; 1024];
                let _ = socket.read(&mut buf).await;

                let response = if with_content_length {
                    "HTTP/1.1 200 OK\r\nContent-Length: 12\r\nConnection: close\r\n\r\nHello World!"
                } else {
                    "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nHello World!"
                };

                let _ = socket.write_all(response.as_bytes()).await;
                let _ = socket.flush().await;
            }
        });

        (addr, handle)
    }

    #[tokio::test]
    async fn test_download_with_content_length() {
        let (addr, _server_handle) = start_mock_server(true).await;
        let temp_dir = std::env::temp_dir();
        let dest = temp_dir.join("test_download_cl.txt");
        if dest.exists() {
            let _ = std::fs::remove_file(&dest);
        }

        let count = Arc::new(AtomicUsize::new(0));
        let count_clone = count.clone();

        let res = download_with_retry(
            &[addr],
            &dest,
            move |downloaded, total| {
                count_clone.fetch_add(1, Ordering::SeqCst);
                println!("Progress: {} / {}", downloaded, total);
            },
        ).await;

        assert!(res.is_ok());
        assert!(dest.exists());
        let content = std::fs::read_to_string(&dest).unwrap();
        assert_eq!(content, "Hello World!");
        assert!(count.load(Ordering::SeqCst) > 0);

        let _ = std::fs::remove_file(&dest);
    }

    #[tokio::test]
    async fn test_download_without_content_length() {
        let (addr, _server_handle) = start_mock_server(false).await;
        let temp_dir = std::env::temp_dir();
        let dest = temp_dir.join("test_download_no_cl.txt");
        if dest.exists() {
            let _ = std::fs::remove_file(&dest);
        }

        let count = Arc::new(AtomicUsize::new(0));
        let count_clone = count.clone();

        let res = download_with_retry(
            &[addr],
            &dest,
            move |downloaded, total| {
                count_clone.fetch_add(1, Ordering::SeqCst);
                println!("Progress: {} / {}", downloaded, total);
            },
        ).await;

        assert!(res.is_ok());
        assert!(dest.exists());
        let content = std::fs::read_to_string(&dest).unwrap();
        assert_eq!(content, "Hello World!");
        assert!(count.load(Ordering::SeqCst) > 0);

        let _ = std::fs::remove_file(&dest);
    }
}
