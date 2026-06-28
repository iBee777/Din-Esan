function getStats(){
  return {
    admins: getAdmins(),
    logs: getUsers().length
  };
}