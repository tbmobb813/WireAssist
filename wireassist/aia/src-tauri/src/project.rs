use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub project_type: ProjectType,
    pub version: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectType {
    Node,
    Rust,
    Python,
    Go,
    Java,
    Ruby,
    Php,
    CSharp,
    Unknown,
}

impl ProjectInfo {
    /// Detect project type from a directory
    pub fn detect(path: &Path) -> Self {
        // Check for various project marker files
        if path.join("package.json").exists() {
            return Self::detect_node(path);
        }

        if path.join("Cargo.toml").exists() {
            return Self::detect_rust(path);
        }

        if path.join("pyproject.toml").exists()
            || path.join("setup.py").exists()
            || path.join("requirements.txt").exists()
        {
            return Self::detect_python(path);
        }

        if path.join("go.mod").exists() {
            return Self::detect_go(path);
        }

        if path.join("pom.xml").exists()
            || path.join("build.gradle").exists()
            || path.join("build.gradle.kts").exists()
        {
            return Self::detect_java(path);
        }

        if path.join("Gemfile").exists() {
            return Self::detect_ruby(path);
        }

        if path.join("composer.json").exists() {
            return Self::detect_php(path);
        }

        if path.join("*.csproj").exists() || path.join("*.sln").exists() {
            return Self::detect_csharp(path);
        }

        ProjectInfo {
            project_type: ProjectType::Unknown,
            version: None,
            name: None,
            description: None,
        }
    }

    fn detect_node(path: &Path) -> Self {
        let package_json_path = path.join("package.json");

        if let Ok(content) = fs::read_to_string(&package_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                return ProjectInfo {
                    project_type: ProjectType::Node,
                    version: json
                        .get("version")
                        .and_then(|v| v.as_str())
                        .map(String::from),
                    name: json.get("name").and_then(|v| v.as_str()).map(String::from),
                    description: json
                        .get("description")
                        .and_then(|v| v.as_str())
                        .map(String::from),
                };
            }
        }

        ProjectInfo {
            project_type: ProjectType::Node,
            version: None,
            name: None,
            description: None,
        }
    }

    fn detect_rust(path: &Path) -> Self {
        let cargo_toml_path = path.join("Cargo.toml");

        if let Ok(content) = fs::read_to_string(&cargo_toml_path) {
            if let Ok(toml) = content.parse::<toml::Value>() {
                let package = toml.get("package");
                return ProjectInfo {
                    project_type: ProjectType::Rust,
                    version: package
                        .and_then(|p| p.get("version"))
                        .and_then(|v| v.as_str())
                        .map(String::from),
                    name: package
                        .and_then(|p| p.get("name"))
                        .and_then(|v| v.as_str())
                        .map(String::from),
                    description: package
                        .and_then(|p| p.get("description"))
                        .and_then(|v| v.as_str())
                        .map(String::from),
                };
            }
        }

        ProjectInfo {
            project_type: ProjectType::Rust,
            version: None,
            name: None,
            description: None,
        }
    }

    fn detect_python(path: &Path) -> Self {
        // Try pyproject.toml first (modern Python)
        let pyproject_path = path.join("pyproject.toml");
        if let Ok(content) = fs::read_to_string(&pyproject_path) {
            if let Ok(toml) = content.parse::<toml::Value>() {
                let project = toml.get("project");
                if let Some(proj) = project {
                    return ProjectInfo {
                        project_type: ProjectType::Python,
                        version: proj
                            .get("version")
                            .and_then(|v| v.as_str())
                            .map(String::from),
                        name: proj.get("name").and_then(|v| v.as_str()).map(String::from),
                        description: proj
                            .get("description")
                            .and_then(|v| v.as_str())
                            .map(String::from),
                    };
                }
            }
        }

        // Fallback to setup.py parsing (older Python projects)
        // For now, just return basic info
        ProjectInfo {
            project_type: ProjectType::Python,
            version: None,
            name: None,
            description: None,
        }
    }

    fn detect_go(path: &Path) -> Self {
        let go_mod_path = path.join("go.mod");

        if let Ok(content) = fs::read_to_string(&go_mod_path) {
            // Parse go.mod for module name
            let lines: Vec<&str> = content.lines().collect();
            let module_name = lines
                .iter()
                .find(|line| line.trim().starts_with("module "))
                .and_then(|line| line.trim().strip_prefix("module "))
                .map(|s| s.trim().to_string());

            return ProjectInfo {
                project_type: ProjectType::Go,
                version: None, // Go modules don't have a project version in go.mod
                name: module_name,
                description: None,
            };
        }

        ProjectInfo {
            project_type: ProjectType::Go,
            version: None,
            name: None,
            description: None,
        }
    }

    fn detect_java(path: &Path) -> Self {
        // Check pom.xml (Maven)
        let pom_path = path.join("pom.xml");
        if pom_path.exists() {
            // For now, basic detection. Could parse XML for version/name
            return ProjectInfo {
                project_type: ProjectType::Java,
                version: None,
                name: None,
                description: None,
            };
        }

        // Check build.gradle (Gradle)
        ProjectInfo {
            project_type: ProjectType::Java,
            version: None,
            name: None,
            description: None,
        }
    }

    fn detect_ruby(path: &Path) -> Self {
        let gemfile_path = path.join("Gemfile");

        if gemfile_path.exists() {
            // Basic Ruby project detection
            // Could parse Gemfile for more info if needed
            return ProjectInfo {
                project_type: ProjectType::Ruby,
                version: None,
                name: None,
                description: None,
            };
        }

        ProjectInfo {
            project_type: ProjectType::Ruby,
            version: None,
            name: None,
            description: None,
        }
    }

    fn detect_php(path: &Path) -> Self {
        let composer_json_path = path.join("composer.json");

        if let Ok(content) = fs::read_to_string(&composer_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                return ProjectInfo {
                    project_type: ProjectType::Php,
                    version: json
                        .get("version")
                        .and_then(|v| v.as_str())
                        .map(String::from),
                    name: json.get("name").and_then(|v| v.as_str()).map(String::from),
                    description: json
                        .get("description")
                        .and_then(|v| v.as_str())
                        .map(String::from),
                };
            }
        }

        ProjectInfo {
            project_type: ProjectType::Php,
            version: None,
            name: None,
            description: None,
        }
    }

    fn detect_csharp(_path: &Path) -> Self {
        // Basic C# project detection
        // Could scan for .csproj files and parse them
        ProjectInfo {
            project_type: ProjectType::CSharp,
            version: None,
            name: None,
            description: None,
        }
    }

    /// Format project info as human-readable string
    pub fn format(&self) -> String {
        let type_name = match self.project_type {
            ProjectType::Node => "Node.js",
            ProjectType::Rust => "Rust",
            ProjectType::Python => "Python",
            ProjectType::Go => "Go",
            ProjectType::Java => "Java",
            ProjectType::Ruby => "Ruby",
            ProjectType::Php => "PHP",
            ProjectType::CSharp => "C#",
            ProjectType::Unknown => return String::from("Unknown project type"),
        };

        let mut parts = vec![type_name.to_string()];

        if let Some(name) = &self.name {
            parts.push(format!("({})", name));
        }

        if let Some(version) = &self.version {
            parts.push(format!("v{}", version));
        }

        parts.join(" ")
    }

    /// Get emoji icon for project type
    pub fn icon(&self) -> &'static str {
        match self.project_type {
            ProjectType::Node => "📦",
            ProjectType::Rust => "🦀",
            ProjectType::Python => "🐍",
            ProjectType::Go => "🐹",
            ProjectType::Java => "☕",
            ProjectType::Ruby => "💎",
            ProjectType::Php => "🐘",
            ProjectType::CSharp => "#️⃣",
            ProjectType::Unknown => "📁",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_detect_node_project() {
        let temp_dir = TempDir::new().unwrap();
        let package_json = r#"
        {
            "name": "my-app",
            "version": "1.0.0",
            "description": "A test app"
        }
        "#;
        fs::write(temp_dir.path().join("package.json"), package_json).unwrap();

        let info = ProjectInfo::detect(temp_dir.path());
        assert_eq!(info.project_type, ProjectType::Node);
        assert_eq!(info.name, Some("my-app".to_string()));
        assert_eq!(info.version, Some("1.0.0".to_string()));
    }

    #[test]
    fn test_detect_rust_project() {
        let temp_dir = TempDir::new().unwrap();
        let cargo_toml = r#"
        [package]
        name = "my-rust-app"
        version = "0.1.0"
        description = "A Rust application"
        "#;
        fs::write(temp_dir.path().join("Cargo.toml"), cargo_toml).unwrap();

        let info = ProjectInfo::detect(temp_dir.path());
        assert_eq!(info.project_type, ProjectType::Rust);
        assert_eq!(info.name, Some("my-rust-app".to_string()));
        assert_eq!(info.version, Some("0.1.0".to_string()));
    }

    #[test]
    fn test_detect_unknown_project() {
        let temp_dir = TempDir::new().unwrap();
        let info = ProjectInfo::detect(temp_dir.path());
        assert_eq!(info.project_type, ProjectType::Unknown);
    }

    #[test]
    fn test_format_project_info() {
        let info = ProjectInfo {
            project_type: ProjectType::Node,
            version: Some("1.0.0".to_string()),
            name: Some("my-app".to_string()),
            description: None,
        };

        let formatted = info.format();
        assert!(formatted.contains("Node.js"));
        assert!(formatted.contains("my-app"));
        assert!(formatted.contains("v1.0.0"));
    }

    #[test]
    fn test_project_icons() {
        assert_eq!(
            ProjectInfo {
                project_type: ProjectType::Node,
                version: None,
                name: None,
                description: None
            }
            .icon(),
            "📦"
        );
        assert_eq!(
            ProjectInfo {
                project_type: ProjectType::Rust,
                version: None,
                name: None,
                description: None
            }
            .icon(),
            "🦀"
        );
        assert_eq!(
            ProjectInfo {
                project_type: ProjectType::Python,
                version: None,
                name: None,
                description: None
            }
            .icon(),
            "🐍"
        );
    }
}
